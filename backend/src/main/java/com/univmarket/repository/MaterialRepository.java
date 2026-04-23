package com.univmarket.repository;

import com.univmarket.entity.Material;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface MaterialRepository extends JpaRepository<Material, Long> {

    // 단건 상세 조회 시 author 같이 fetch — 프론트가 authorId/nickname 필요.
    @EntityGraph(attributePaths = {"author"})
    @Override
    Optional<Material> findById(Long id);

    Page<Material> findByHiddenFalseAndCopyrightDeletedFalse(Pageable pageable);

    List<Material> findByAuthorIdAndHiddenFalse(Long authorId);

    Page<Material> findByAuthorId(Long authorId, Pageable pageable);

    @Modifying
    @Query("UPDATE Material m SET m.salesCount = m.salesCount + 1 WHERE m.id = :id")
    void incrementSalesCount(@Param("id") Long id);

    @Modifying
    @Query("UPDATE Material m SET m.salesCount = m.salesCount - 1 WHERE m.id = :id AND m.salesCount > 0")
    void decrementSalesCount(@Param("id") Long id);

    @Modifying
    @Query("UPDATE Material m SET m.hidden = :hidden WHERE m.author.id = :authorId")
    int setHiddenByAuthor(@Param("authorId") Long authorId, @Param("hidden") boolean hidden);
}
