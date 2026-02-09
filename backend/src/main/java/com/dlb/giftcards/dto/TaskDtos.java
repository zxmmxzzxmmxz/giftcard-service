package com.dlb.giftcards.dto;

import com.dlb.giftcards.entity.TaskStatus;
import com.dlb.giftcards.entity.TaskType;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;

public class TaskDtos {

    public static class CreateTaskRequest {
        @NotNull
        public TaskType type;

        @NotNull
        public JsonNode data;
    }

    public static class CompleteTaskRequest {
        @NotNull
        public JsonNode result;
    }

    public static class FailTaskRequest {
        @NotBlank
        public String error;

        public JsonNode result;
    }

    public static class TaskResponse {
        public String id;
        public TaskType type;
        public TaskStatus status;
        public JsonNode data;
        public JsonNode result;
        public String lastError;
        public Instant createdAt;
        public Instant updatedAt;
    }

    public static class ArtifactResponse {
        public String id;
        public String taskId;
        public String filename;
        public String contentType;
        public long sizeBytes;
        public String sha256;
        public Instant createdAt;
        public String downloadUrl;
    }
}
