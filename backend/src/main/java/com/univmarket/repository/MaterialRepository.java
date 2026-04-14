package com.univmarket.repository;

import com.univmarket.entity.Material;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface MaterialRepository extends JpaRepository<Material, Long> {

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
