package com.kpitracking.entity.converter;

import com.kpitracking.security.DataProtection;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * Mã hoá/giải mã trong suốt cho các cột nhạy cảm cần đọc lại được.
 *
 * <p>Hibernate tự khởi tạo converter chứ không lấy từ Spring context nên phụ thuộc được đưa vào
 * qua trường static — Spring gọi setter một lần lúc khởi động, mọi thể hiện dùng chung.
 *
 * <p><b>Không dùng cho cột cần tra cứu hay đánh unique index</b>: AES-GCM dùng IV ngẫu nhiên nên
 * cùng một giá trị mã hoá hai lần ra hai chuỗi khác nhau. Cột như vậy phải dùng
 * {@link DataProtection#blindIndex(String)}.
 */
@Converter
@Component
public class EncryptedStringConverter implements AttributeConverter<String, String> {

    private static DataProtection dataProtection;

    @Autowired
    public void setDataProtection(DataProtection dataProtection) {
        EncryptedStringConverter.dataProtection = dataProtection;
    }

    @Override
    public String convertToDatabaseColumn(String attribute) {
        return dataProtection.encrypt(attribute);
    }

    @Override
    public String convertToEntityAttribute(String dbData) {
        return dataProtection.decrypt(dbData);
    }
}
