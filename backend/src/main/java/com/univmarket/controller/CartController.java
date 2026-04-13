package com.univmarket.controller;

import com.univmarket.entity.Cart;
import com.univmarket.security.FirebaseUserPrincipal;
import com.univmarket.service.CartService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/cart")
@RequiredArgsConstructor
public class CartController {

    private final CartService cartService;

    /**
     * 장바구니 조회
     */
    @GetMapping
    public ResponseEntity<List<Cart>> getCartItems(
            @AuthenticationPrincipal FirebaseUserPrincipal principal) {
        List<Cart> items = cartService.getCartItems(principal.getUid());
        return ResponseEntity.ok(items);
    }

    /**
     * 장바구니 추가
     */
    @PostMapping
    public ResponseEntity<Cart> addToCart(
            @AuthenticationPrincipal FirebaseUserPrincipal principal,
            @RequestBody Map<String, Object> body) {
        Long materialId = ((Number) body.get("materialId")).longValue();
        Cart cart = cartService.addToCart(principal.getUid(), materialId);
        return ResponseEntity.ok(cart);
    }

    /**
     * 장바구니 삭제
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Boolean>> removeFromCart(
            @AuthenticationPrincipal FirebaseUserPrincipal principal,
            @PathVariable Long id) {
        cartService.removeFromCart(principal.getUid(), id);
        return ResponseEntity.ok(Map.of("success", true));
    }
}
