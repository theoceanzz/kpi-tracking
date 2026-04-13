package com.kpitracking.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${app.mail.from}")
    private String fromEmail;

    @Async
    public void sendEmail(String to, String subject, String body) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromEmail);
            message.setTo(to);
            message.setSubject(subject);
            message.setText(body);
            mailSender.send(message);
            log.info("Email sent successfully to: {}", to);
        } catch (Exception e) {
            log.error("Failed to send email to {}: {}", to, e.getMessage());
        }
    }

    @Async
    public void sendResetPasswordEmail(String to, String resetPasswordToken) {
        String subject = "KPI Tracking - Reset Password";
        String body = String.format(
                "Hello,\n\n" +
                "You have requested to reset your password.\n\n" +
                "Your reset token is: %s\n\n" +
                "This token will expire in 1 hour.\n\n" +
                "If you did not request this, please ignore this email.\n\n" +
                "Best regards,\nKPI Tracking Team",
                resetPasswordToken
        );
        sendEmail(to, subject, body);
    }

    @Async
    public void sendVerifyEmail(String to, String verifyEmailToken) {
        String subject = "KPI Tracking - Verify Your Email";
        String body = String.format(
                "Hello,\n\n" +
                "Please verify your email using this token: %s\n\n" +
                "This token will expire in 24 hours.\n\n" +
                "Best regards,\nKPI Tracking Team",
                verifyEmailToken
        );
        sendEmail(to, subject, body);
    }

    @Async
    public void sendWelcomeEmail(String to, String fullName) {
        String subject = "Welcome to KPI Tracking";
        String body = String.format(
                "Hello %s,\n\n" +
                "Welcome to KPI Tracking! Your account has been created successfully.\n\n" +
                "You can now log in and start tracking your KPIs.\n\n" +
                "Best regards,\nKPI Tracking Team",
                fullName
        );
        sendEmail(to, subject, body);
    }

    @Async
    public void sendNotificationEmail(String to, String title, String message) {
        sendEmail(to, "KPI Tracking - " + title, message);
    }
}
