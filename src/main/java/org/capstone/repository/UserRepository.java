package org.capstone.repository;
import org.springframework.stereotype.Repository;
import org.capstone.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

//User Entity의 내용으로 매핑
@Repository
public interface UserRepository extends JpaRepository<User, String> {
    //Optional Entity가 Null이면 empty 반환 아니면 entity 반환
    Optional<User> findByUserid(String userid);
    Optional<User> findUserByEmailAndProvider(String email, String provider);
}

