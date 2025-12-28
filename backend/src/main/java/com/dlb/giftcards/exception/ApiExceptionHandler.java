package com.dlb.giftcards.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String, Object> badRequest(IllegalArgumentException ex) {
        return Map.of(
                "error", "bad_request",
                "message", ex.getMessage()
        );
    }

    @ExceptionHandler(IllegalStateException.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public Map<String, Object> serverError(IllegalStateException ex) {
        return Map.of(
                "error", "server_error",
                "message", ex.getMessage()
        );
    }
}
