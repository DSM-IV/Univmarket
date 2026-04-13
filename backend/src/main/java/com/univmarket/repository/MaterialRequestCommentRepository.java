package com.univmarket.repository;

import com.univmarket.entity.MaterialRequestComment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MaterialRequestCommentRepository extends JpaRepository<MaterialRequestComment, Long> {

    List<MaterialRequestComment> findByRequestIdOrderByCreatedAtAsc(Long requestId);
}
