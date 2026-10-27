package com.kpitracking.repository.organization;

import com.kpitracking.entity.organization.District;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface DistrictRepository extends JpaRepository<District, UUID> {

    List<District> findByProvinceId(UUID provinceId);
}
