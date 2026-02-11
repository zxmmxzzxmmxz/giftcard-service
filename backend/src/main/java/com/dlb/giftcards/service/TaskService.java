package com.dlb.giftcards.service;

import com.dlb.giftcards.dto.TaskDtos;
import com.dlb.giftcards.entity.AutomationTaskArtifactEntity;
import com.dlb.giftcards.entity.AutomationTaskEntity;
import com.dlb.giftcards.entity.TaskStatus;
import com.dlb.giftcards.entity.TaskType;
import com.dlb.giftcards.entity.GiftCardAnycardEntity;
import com.dlb.giftcards.repository.AutomationTaskArtifactRepository;
import com.dlb.giftcards.repository.AutomationTaskRepository;
import com.dlb.giftcards.repository.GiftCardAnycardRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.Comparator;
import java.util.List;
import java.util.HashSet;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

@Service
public class TaskService {

    private final AutomationTaskRepository repo;
    private final AutomationTaskArtifactRepository artifactRepo;
    private final AnycardService anycardService;
    private final GiftCardAnycardRepository anycardRepo;
    private final ObjectMapper om;
    private final Path artifactsDir;

    public TaskService(
            AutomationTaskRepository repo,
            AutomationTaskArtifactRepository artifactRepo,
            AnycardService anycardService,
            GiftCardAnycardRepository anycardRepo,
            ObjectMapper om,
            @Value("${APP_ARTIFACTS_DIR:./data/artifacts}") String artifactsDir
    ) {
        this.repo = repo;
        this.artifactRepo = artifactRepo;
        this.anycardService = anycardService;
        this.anycardRepo = anycardRepo;
        this.om = om;
        this.artifactsDir = Path.of(artifactsDir);
    }

    public AutomationTaskEntity getOrThrow(String id) {
        return repo.findById(id).orElseThrow(() -> new IllegalArgumentException("Task not found: " + id));
    }

    public List<AutomationTaskEntity> listAll() {
        List<AutomationTaskEntity> all = repo.findAll();
        all.sort(Comparator.comparing(AutomationTaskEntity::getUpdatedAt, Comparator.nullsLast(Comparator.naturalOrder())).reversed());
        return all;
    }

    @Transactional
    public AutomationTaskEntity create(TaskDtos.CreateTaskRequest req) {
        AutomationTaskEntity e = new AutomationTaskEntity();
        e.setType(req.type);
        e.setStatus(TaskStatus.READY);
        e.setDataJson(writeJson(req.data));
        return repo.save(e);
    }

    @Transactional
    public Optional<AutomationTaskEntity> next(String type) {
        if (type == null || type.isBlank()) return Optional.empty();

        TaskType wantedType = TaskType.fromString(type);

        Optional<AutomationTaskEntity> found;
        switch (wantedType) {
            case GETMYBONUS_ANYCARD -> {
                ensureAnycardRedeemTasks();
                found = repo.findFirstByStatusAndTypeOrderByCreatedAtAsc(TaskStatus.READY, wantedType);
            }
            default -> {
                return Optional.empty();
            }
        }

        if (found.isEmpty()) return Optional.empty();

        AutomationTaskEntity task = found.get();
        if (wantedType == TaskType.GETMYBONUS_ANYCARD) {
            task = ensureTaskHasAnycardSerialNumber(task);
        }
        task.setStatus(TaskStatus.IN_PROGRESS);
        task.setLastError(null);
        return Optional.of(repo.save(task));
    }

    private AutomationTaskEntity ensureTaskHasAnycardSerialNumber(AutomationTaskEntity task) {
        JsonNode data = readJsonOrNull(task.getDataJson());
        String existingSerial = firstTextOrNull(data, "serialNumber", "serial_number");
        if (existingSerial != null) return task;

        String anycardId = firstTextOrNull(data, "anycardId");
        String cardNumber = firstTextOrNull(data, "cardNumber", "card_number");

        GiftCardAnycardEntity anycard = null;
        if (anycardId != null) {
            anycard = anycardRepo.findById(anycardId).orElse(null);
        }
        if (anycard == null && cardNumber != null) {
            anycard = anycardRepo.findFirstByCardNumber(cardNumber).orElse(null);
        }
        if (anycard == null || anycard.getSerialNumber() == null || anycard.getSerialNumber().isBlank()) {
            return task;
        }

        ObjectNode next = (data != null && data.isObject()) ? (ObjectNode) data : om.createObjectNode();
        next.put("serialNumber", anycard.getSerialNumber());
        if (anycardId == null) next.put("anycardId", anycard.getId());
        task.setDataJson(writeJson(next));
        return task;
    }

    @Transactional
    public AutomationTaskEntity complete(String id, TaskDtos.CompleteTaskRequest req) {
        AutomationTaskEntity task = getOrThrow(id);
        task.setStatus(TaskStatus.SUCCEEDED);
        task.setResultJson(writeJson(req.result));
        task.setLastError(null);
        if (task.getType() == TaskType.GETMYBONUS_ANYCARD) {
            anycardService.upsertFromTaskResult(req.result);
            markRedeemedAnycard(task, req.result);
        }
        return repo.save(task);
    }

    private void markRedeemedAnycard(AutomationTaskEntity task, JsonNode result) {
        JsonNode data = readJsonOrNull(task.getDataJson());

        String anycardId = firstTextOrNull(data, "anycardId");
        String serialNumber = firstTextOrNull(result, "serial_number", "serialNumber");
        if (serialNumber == null) {
            serialNumber = firstTextOrNull(data, "serialNumber", "serial_number");
        }

        GiftCardAnycardEntity anycard = null;
        if (anycardId != null) {
            anycard = anycardRepo.findById(anycardId).orElse(null);
        }
        if (anycard == null && serialNumber != null) {
            anycard = anycardRepo.findFirstBySerialNumber(serialNumber).orElse(null);
        }

        if (anycard == null) {
            if (anycardId != null || serialNumber != null) {
                throw new IllegalStateException("Redeemed anycard not found to clear needsRedeem (anycardId=" + anycardId + ", serialNumber=" + serialNumber + ")");
            }
            return;
        }

        anycard.setNeedsRedeem(false);
        anycardRepo.save(anycard);
    }

    private void ensureAnycardRedeemTasks() {
        List<GiftCardAnycardEntity> needsRedeem = anycardRepo.findByNeedsRedeemTrue();
        if (needsRedeem.isEmpty()) return;

        List<AutomationTaskEntity> anycardTasks = repo.findByType(TaskType.GETMYBONUS_ANYCARD);

        Set<String> completedCardNumbers = new HashSet<>();
        Set<String> pendingCardNumbers = new HashSet<>();

        for (AutomationTaskEntity t : anycardTasks) {
            if (t.getStatus() == TaskStatus.SUCCEEDED) {
                String cardNumber = firstTextOrNull(readJsonOrNull(t.getResultJson()), "card_number", "cardNumber");
                if (cardNumber != null) completedCardNumbers.add(cardNumber);
            } else if (t.getStatus() == TaskStatus.READY || t.getStatus() == TaskStatus.IN_PROGRESS) {
                String cardNumber = firstTextOrNull(readJsonOrNull(t.getDataJson()), "cardNumber", "card_number");
                if (cardNumber != null) pendingCardNumbers.add(cardNumber);
            }
        }

        for (GiftCardAnycardEntity a : needsRedeem) {
            String cardNumber = a.getCardNumber();
            if (cardNumber == null || cardNumber.isBlank()) continue;
            if (completedCardNumbers.contains(cardNumber)) continue;
            if (pendingCardNumbers.contains(cardNumber)) continue;

            AutomationTaskEntity t = new AutomationTaskEntity();
            t.setType(TaskType.GETMYBONUS_ANYCARD);
            t.setStatus(TaskStatus.READY);
            var data = om.createObjectNode();
            data.put("anycardId", a.getId());
            data.put("cardNumber", a.getCardNumber());
            if (a.getSerialNumber() != null) data.put("serialNumber", a.getSerialNumber());
            if (a.getAnycardType() != null) data.put("anycardType", a.getAnycardType().getCode());
            t.setDataJson(writeJson(data));
            repo.save(t);
        }
    }

    private String firstTextOrNull(JsonNode obj, String... keys) {
        if (obj == null || obj.isNull()) return null;
        for (String k : keys) {
            JsonNode node = obj.get(k);
            if (node == null || node.isNull()) continue;
            String v = node.asText();
            if (v != null && !v.isBlank()) return v;
        }
        return null;
    }

    @Transactional
    public AutomationTaskEntity fail(String id, TaskDtos.FailTaskRequest req) {
        AutomationTaskEntity task = getOrThrow(id);
        task.setStatus(TaskStatus.FAILED);
        task.setLastError(req.error);
        if (req.result != null) {
            task.setResultJson(writeJson(req.result));
        }
        return repo.save(task);
    }

    @Transactional
    public void deleteTask(String id) {
        AutomationTaskEntity task = getOrThrow(id);

        // Clean up artifacts (DB + best-effort file delete)
        for (AutomationTaskArtifactEntity a : artifactRepo.findByTaskIdOrderByCreatedAtAsc(task.getId())) {
            try {
                Path p = Path.of(a.getStoragePath());
                Files.deleteIfExists(p);
            } catch (Exception ignored) {
            }
            artifactRepo.delete(a);
        }

        repo.delete(task);
    }

    public JsonNode readJsonOrNull(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return om.readTree(json);
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to parse JSON", ex);
        }
    }

    public String writeJson(JsonNode node) {
        try {
            return om.writeValueAsString(node == null ? om.createObjectNode() : node);
        } catch (Exception ex) {
            throw new IllegalArgumentException("Invalid JSON", ex);
        }
    }

    public AutomationTaskArtifactEntity storeArtifact(String taskId, MultipartFile file) {
        Objects.requireNonNull(file, "file");
        AutomationTaskEntity task = getOrThrow(taskId);

        String originalName = file.getOriginalFilename();
        String safeName = sanitizeFilename(originalName == null ? "artifact" : originalName);

        AutomationTaskArtifactEntity artifact = new AutomationTaskArtifactEntity();
        artifact.setTaskId(task.getId());
        artifact.setFilename(safeName);
        artifact.setContentType(file.getContentType());
        artifact.setSizeBytes(file.getSize());

        try {
            Files.createDirectories(artifactsDir.resolve(task.getId()));

            String artifactId = java.util.UUID.randomUUID().toString();
            artifact.setId(artifactId);

            Path storedPath = artifactsDir.resolve(task.getId()).resolve(artifactId + "_" + safeName);

            MessageDigest sha256 = MessageDigest.getInstance("SHA-256");
            try (InputStream in = file.getInputStream()) {
                byte[] buf = new byte[8192];
                int read;
                while ((read = in.read(buf)) > 0) {
                    sha256.update(buf, 0, read);
                }
            }

            try (InputStream in = file.getInputStream()) {
                Files.copy(in, storedPath);
            }

            artifact.setSha256(toHex(sha256.digest()));
            artifact.setStoragePath(storedPath.toAbsolutePath().toString());
            return artifactRepo.save(artifact);
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to store artifact", ex);
        }
    }

    public List<AutomationTaskArtifactEntity> listArtifacts(String taskId) {
        getOrThrow(taskId);
        return artifactRepo.findByTaskIdOrderByCreatedAtAsc(taskId);
    }

    public AutomationTaskArtifactEntity getArtifactOrThrow(String artifactId) {
        return artifactRepo.findById(artifactId).orElseThrow(() -> new IllegalArgumentException("Artifact not found: " + artifactId));
    }

    private String sanitizeFilename(String name) {
        String s = name.trim();
        if (s.isBlank()) return "artifact";
        s = s.replaceAll("[\\\\/\\r\\n\\t\\0]", "_");
        s = s.replaceAll("[^a-zA-Z0-9._ -]", "_");
        if (s.length() > 180) s = s.substring(0, 180);
        return s;
    }

    private String toHex(byte[] bytes) {
        char[] out = new char[bytes.length * 2];
        char[] hex = "0123456789abcdef".toCharArray();
        for (int i = 0; i < bytes.length; i++) {
            int v = bytes[i] & 0xFF;
            out[i * 2] = hex[v >>> 4];
            out[i * 2 + 1] = hex[v & 0x0F];
        }
        return new String(out);
    }
}
