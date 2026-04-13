package com.univmarket.repository;

import com.univmarket.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByFirebaseUid(String firebaseUid);

    Optional<User> findByNickname(String nickname);

    boolean existsByNickname(String nickname);

    @Modifying
    @Query("UPDATE User u SET u.points = u.points + :amount, u.totalEarned = u.totalEarned + :amount WHERE u.id = :userId AND u.points + :amount >= 0")
    int addPoints(@Param("userId") Long userId, @Param("amount") BigDecimal amount);

    @Modifying
    @Query("UPDATE User u SET u.points = u.points - :amount, u.totalSpent = u.totalSpent + :amount WHERE u.id = :userId AND u.points >= :amount")
    int deductPoints(@Param("userId") Long userId, @Param("amount") BigDecimal amount);

    @Modifying
    @Query("UPDATE User u SET u.pendingEarnings = u.pendingEarnings + :amount, u.totalEarned = u.totalEarned + :amount WHERE u.id = :userId")
    int addPendingEarnings(@Param("userId") Long userId, @Param("amount") BigDecimal amount);

    @Modifying
    @Query("UPDATE User u SET u.earnings = u.earnings - :amount WHERE u.id = :userId AND u.earnings >= :amount")
    int deductEarnings(@Param("userId") Long userId, @Param("amount") BigDecimal amount);
}
