package com.univmarket.security;

import com.univmarket.entity.User;
import com.univmarket.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class UserRoleService {

    private final UserRepository userRepository;

    public List<SimpleGrantedAuthority> getAuthorities(String firebaseUid) {
        List<SimpleGrantedAuthority> authorities = new ArrayList<>();
        authorities.add(new SimpleGrantedAuthority("ROLE_USER"));

        Optional<User> user = userRepository.findByFirebaseUid(firebaseUid);
        if (user.isPresent()) {
            if ("admin".equals(user.get().getRole())) {
                authorities.add(new SimpleGrantedAuthority("ROLE_ADMIN"));
            }
            if (user.get().isBanned()) {
                authorities.clear(); // 밴된 유저는 권한 없음
            }
        }

        return authorities;
    }
}
