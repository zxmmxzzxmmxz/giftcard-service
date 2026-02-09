package com.dlb.giftcards.service;

import com.dlb.giftcards.dto.TaskDtos;
import com.dlb.giftcards.entity.AutomationTaskArtifactEntity;
import com.dlb.giftcards.entity.AutomationTaskEntity;
import com.dlb.giftcards.entity.TaskStatus;
import com.dlb.giftcards.entity.TaskType;
import com.dlb.giftcards.repository.AutomationTaskArtifactRepository;
import com.dlb.giftcards.repository.AutomationTaskRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Service
public class TaskService {

    private final AutomationTaskRepository repo;
    private final AutomationTaskArtifactRepository artifactRepo;
    private final AnycardService anycardService;
    private final ObjectMapper om;
    private final Path artifactsDir;

    public TaskService(
            AutomationTaskRepository repo,
            AutomationTaskArtifactRepository artifactRepo,
            AnycardService anycardService,
            ObjectMapper om,
            @Value("${APP_ARTIFACTS_DIR:./data/artifacts}") String artifactsDir
    ) {
        this.repo = repo;
        this.artifactRepo = artifactRepo;
        this.anycardService = anycardService;
        this.om = om;
        this.artifactsDir = Path.of(artifactsDir);
    }

    public AutomationTaskEntity getOrThrow(String id) {
        return repo.findById(id).orElseThrow(() -> new IllegalArgumentException("Task not found: " + id));
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
        Optional<AutomationTaskEntity> found;
        if (type == null || type.isBlank()) {
            found = repo.findFirstByStatusOrderByCreatedAtAsc(TaskStatus.READY);
        } else {
            found = repo.findFirstByStatusAndTypeOrderByCreatedAtAsc(TaskStatus.READY, TaskType.fromString(type));
        }

        if (found.isEmpty()) return Optional.empty();

        AutomationTaskEntity task = found.get();
        task.setStatus(TaskStatus.IN_PROGRESS);
        task.setLastError(null);
        return Optional.of(repo.save(task));
    }

    @Transactional
    public AutomationTaskEntity complete(String id, TaskDtos.CompleteTaskRequest req) {
        AutomationTaskEntity task = getOrThrow(id);
        task.setStatus(TaskStatus.SUCCEEDED);
        task.setResultJson(writeJson(req.result));
        task.setLastError(null);
        if (task.getType() == TaskType.GETMYBONUS_ANYCARD) {
            anycardService.upsertFromTaskResult(req.result);
        }
        return repo.save(task);
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
