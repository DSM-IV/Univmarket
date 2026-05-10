package com.univmarket.repository;

import com.univmarket.entity.MaterialRequestNeed;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface MaterialRequestNeedRepository extends JpaRepository<MaterialRequestNeed, Long> {

    boolean existsByRequestIdAndUserId(Long requestId, Long userId);

    void deleteByRequestIdAndUserId(Long requestId, Long userId);

    long countByRequestId(Long requestId);

    @Query("SELECT n.requestId FROM MaterialRequestNeed n WHERE n.userId = :userId AND n.requestId IN :requestIds")
    List<Long> findRequestIdsByUserIdAndRequestIdIn(
            @Param("userId") Long userId,
            @Param("requestIds") Collection<Long> requestIds);
}
