package com.example.weblongmanloc.repository;

import com.example.weblongmanloc.entity.VaiTro;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface VaiTroRepository extends JpaRepository<VaiTro, String> {
    Optional<VaiTro> findByMaVaiTro(String maVaiTro);
}
