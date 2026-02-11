package com.dlb.giftcards.controller;

import com.dlb.giftcards.service.GmailWalmartGiftCardListenerService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/walmart-giftcards/email-listener")
public class WalmartGiftCardEmailListenerController {

    private final GmailWalmartGiftCardListenerService listener;

    public WalmartGiftCardEmailListenerController(GmailWalmartGiftCardListenerService listener) {
        this.listener = listener;
    }

    @GetMapping("/status")
    public GmailWalmartGiftCardListenerService.Status status() {
        return listener.status();
    }

    @PostMapping("/start")
    public GmailWalmartGiftCardListenerService.Status start() {
        return listener.start();
    }

    @PostMapping("/stop")
    public GmailWalmartGiftCardListenerService.Status stop() {
        return listener.stop();
    }
}

