package com.dlb.giftcards.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.UuidGenerator;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;

@Entity
@Table(name = "gift_card")
public class GiftCardEntity {

    @Id
    @GeneratedValue
    @UuidGenerator
    @Column(length = 36, updatable = false, nullable = false)
    private String id;

    @Column(name = "template_id", nullable = false, length = 36)
    private String templateId;

    @Column(name = "display_name")
    private String displayName;

    @Lob
    @Column(name = "data_json", nullable = false)
    private String dataJson;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "archived", nullable = false)
    private boolean archived = false;

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now().truncatedTo(ChronoUnit.SECONDS);
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now().truncatedTo(ChronoUnit.SECONDS);
    }

    // getters/setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTemplateId() { return templateId; }
    public void setTemplateId(String templateId) { this.templateId = templateId; }

    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }

    public String getDataJson() { return dataJson; }
    public void setDataJson(String dataJson) { this.dataJson = dataJson; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }

    public boolean isArchived() { return archived; }
    public void setArchived(boolean archived) { this.archived = archived; }
}
