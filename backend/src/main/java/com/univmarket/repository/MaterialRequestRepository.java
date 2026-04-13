package com.univmarket.repository;

import com.univmarket.entity.MaterialRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MaterialRequestRepository extends JpaRepository<MaterialRequest, Long> {

    Page<MaterialRequest> findAllByOrderByCreatedAtDesc(Pageable pageable);

    @Modifying
    @Query("UPDATE MaterialRequest mr SET mr.needCount = mr.needCount + :delta WHERE mr.id = :id")
    int updateNeedCount(@Param("id") Long id, @Param("delta") int delta);
}
