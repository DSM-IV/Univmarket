package com.univmarket.service;

import com.univmarket.entity.Cart;
import com.univmarket.entity.Material;
import com.univmarket.entity.User;
import com.univmarket.exception.ApiException;
import com.univmarket.repository.CartRepository;
import com.univmarket.repository.MaterialRepository;
import com.univmarket.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class CartService {

    private final UserRepository userRepository;
    private final CartRepository cartRepository;
    private final MaterialRepository materialRepository;

    @Transactional(readOnly = true)
    public List<Cart> getCartItems(String firebaseUid) {
        User user = userRepository.findByFirebaseUid(firebaseUid)
                .orElseThrow(() -> ApiException.notFound("사용자를 찾을 수 없습니다."));
        return cartRepository.findByUserIdOrderByAddedAtDesc(user.getId());
    }

    @Transactional
    public Cart addToCart(String firebaseUid, Long materialId) {
        User user = userRepository.findByFirebaseUid(firebaseUid)
                .orElseThrow(() -> ApiException.notFound("사용자를 찾을 수 없습니다."));
        Material material = materialRepository.findById(materialId)
                .orElseThrow(() -> ApiException.notFound("자료를 찾을 수 없습니다."));

        if (material.isHidden() || material.isCopyrightDeleted()) {
            throw ApiException.badRequest("장바구니에 담을 수 없는 자료입니다.");
        }

        if (cartRepository.existsByUserIdAndMaterialId(user.getId(), materialId)) {
            throw ApiException.conflict("이미 장바구니에 있는 자료입니다.");
        }

        String authorName = material.getAuthor() != null ? material.getAuthor().getNickname() : "";

        return cartRepository.save(Cart.builder()
                .user(user)
                .materialId(materialId)
                .title(material.getTitle())
                .price(material.getPrice())
                .author(authorName)
                .category(material.getCategory())
                .build());
    }

    @Transactional
    public void removeFromCart(String firebaseUid, Long cartId) {
        User user = userRepository.findByFirebaseUid(firebaseUid)
                .orElseThrow(() -> ApiException.notFound("사용자를 찾을 수 없습니다."));

        Cart cart = cartRepository.findById(cartId)
                .orElseThrow(() -> ApiException.notFound("장바구니 항목을 찾을 수 없습니다."));

        if (!cart.getUser().getId().equals(user.getId())) {
            throw ApiException.forbidden("본인의 장바구니만 수정할 수 있습니다.");
        }

        cartRepository.delete(cart);
    }
}
