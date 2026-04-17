package com.kpitracking.service;

import com.kpitracking.dto.response.scope.ScopeResponse;
import com.kpitracking.enums.ScopeCode;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.mapper.ScopeMapper;
import com.kpitracking.repository.ScopeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ScopeService {

    private final ScopeRepository scopeRepository;
    private final ScopeMapper scopeMapper;

    @Transactional(readOnly = true)
    public List<ScopeResponse> listScopes() {
        return scopeMapper.toResponseList(scopeRepository.findAll());
    }

    @Transactional(readOnly = true)
    public ScopeResponse getScopeByCode(String code) {
        ScopeCode scopeCode;
        try {
            scopeCode = ScopeCode.valueOf(code.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ResourceNotFoundException("Scope", "code", code);
        }
        return scopeRepository.findByCode(scopeCode)
                .map(scopeMapper::toResponse)
                .orElseThrow(() -> new ResourceNotFoundException("Scope", "code", code));
    }
}
