package com.dlb.giftcards.dto;

import java.util.List;

public class BarcodeDtos {

    public static class DecodeBarcodeResponse {
        public String rawText;
        public String serialNumber;
        public boolean usedOpenCv;

        // Present only when debug=true.
        public Integer attempts;
        public List<String> tried;
        public String error;
    }
}

