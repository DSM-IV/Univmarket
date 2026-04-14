package com.univmarket.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.*;

@Embeddable
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class MaterialFile {

    @Column(name = "file_url", length = 1000)
    private String fileUrl;

    @Column(name = "file_key", length = 500)
    private String fileKey;

    @Column(name = "file_name", length = 200)
    private String fileName;

    @Column(name = "file_size")
    private Long fileSize;

    @Column(name = "file_type", length = 50)
    private String fileType;
}
