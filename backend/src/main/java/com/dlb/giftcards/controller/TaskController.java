package com.dlb.giftcards.controller;

import com.dlb.giftcards.dto.TaskDtos;
import com.dlb.giftcards.entity.AutomationTaskArtifactEntity;
import com.dlb.giftcards.entity.AutomationTaskEntity;
import com.dlb.giftcards.service.TaskService;
import jakarta.validation.Valid;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    private final TaskService service;

    public TaskController(TaskService service) {
        this.service = service;
    }

    @PostMapping
    public TaskDtos.TaskResponse create(@RequestBody @Valid TaskDtos.CreateTaskRequest req) {
        return toResp(service.create(req));
    }

    @PostMapping("/create")
    public TaskDtos.TaskResponse createAlias(@RequestBody @Valid TaskDtos.CreateTaskRequest req) {
        return toResp(service.create(req));
    }

    @GetMapping("/{id}")
    public TaskDtos.TaskResponse get(@PathVariable("id") String id) {
        return toResp(service.getOrThrow(id));
    }

    @GetMapping
    public List<TaskDtos.TaskResponse> list() {
        return service.listAll().stream().map(this::toResp).toList();
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable("id") String id) {
        service.deleteTask(id);
    }

    @GetMapping("/next")
    public ResponseEntity<TaskDtos.TaskResponse> next(@RequestParam(name = "type", required = false) String type) {
        return service.next(type)
                .map(t -> ResponseEntity.ok(toResp(t)))
                .orElseGet(() -> ResponseEntity.status(204).build());
    }

    @PostMapping("/{id}/complete")
    public TaskDtos.TaskResponse complete(@PathVariable("id") String id, @RequestBody @Valid TaskDtos.CompleteTaskRequest req) {
        return toResp(service.complete(id, req));
    }

    @PostMapping("/{id}/fail")
    public TaskDtos.TaskResponse fail(@PathVariable("id") String id, @RequestBody @Valid TaskDtos.FailTaskRequest req) {
        return toResp(service.fail(id, req));
    }

    @PostMapping(path = "/{id}/artifacts", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public TaskDtos.ArtifactResponse uploadArtifact(
            @PathVariable("id") String id,
            @RequestPart("file") MultipartFile file
    ) {
        return toArtifactResp(service.storeArtifact(id, file));
    }

    @GetMapping("/{id}/artifacts")
    public List<TaskDtos.ArtifactResponse> listArtifacts(@PathVariable("id") String id) {
        return service.listArtifacts(id).stream().map(this::toArtifactResp).toList();
    }

    @GetMapping("/artifacts/{artifactId}")
    public ResponseEntity<Resource> download(@PathVariable("artifactId") String artifactId) {
        AutomationTaskArtifactEntity a = service.getArtifactOrThrow(artifactId);
        Path path = Path.of(a.getStoragePath());
        if (!Files.exists(path)) {
            throw new IllegalArgumentException("Artifact file not found: " + artifactId);
        }

        String contentType = a.getContentType();
        if (contentType == null || contentType.isBlank()) {
            try {
                contentType = Files.probeContentType(path);
            } catch (Exception ignored) {
            }
        }
        if (contentType == null || contentType.isBlank()) contentType = MediaType.APPLICATION_OCTET_STREAM_VALUE;

        Resource resource = new FileSystemResource(path);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, contentType)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + a.getFilename() + "\"")
                .body(resource);
    }

    private TaskDtos.TaskResponse toResp(AutomationTaskEntity e) {
        TaskDtos.TaskResponse r = new TaskDtos.TaskResponse();
        r.id = e.getId();
        r.type = e.getType();
        r.status = e.getStatus();
        r.data = service.readJsonOrNull(e.getDataJson());
        r.result = service.readJsonOrNull(e.getResultJson());
        r.lastError = e.getLastError();
        r.createdAt = e.getCreatedAt();
        r.updatedAt = e.getUpdatedAt();
        return r;
    }

    private TaskDtos.ArtifactResponse toArtifactResp(AutomationTaskArtifactEntity a) {
        TaskDtos.ArtifactResponse r = new TaskDtos.ArtifactResponse();
        r.id = a.getId();
        r.taskId = a.getTaskId();
        r.filename = a.getFilename();
        r.contentType = a.getContentType();
        r.sizeBytes = a.getSizeBytes();
        r.sha256 = a.getSha256();
        r.createdAt = a.getCreatedAt();
        r.downloadUrl = "/api/tasks/artifacts/" + a.getId();
        return r;
    }
}
