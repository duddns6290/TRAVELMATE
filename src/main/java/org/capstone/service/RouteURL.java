package org.capstone.service;

import java.io.UnsupportedEncodingException;
import java.net.URLEncoder;

public class RouteURL {

    public static String buildRouteUrl(String fromName, double fromLon, double fromLat,
                                       String toName, double toLon, double toLat,
                                       String mode) {
        try {
            String encodedFromName = URLEncoder.encode(fromName, "UTF-8");
            String encodedToName = URLEncoder.encode(toName, "UTF-8");

            String base = "https://map.naver.com/p/directions/";
            String start = fromLon + "," + fromLat + "," + encodedFromName + ",START,PLACE_POI";
            String end = toLon + "," + toLat + "," + encodedToName + ",END,PLACE_POI";

            String type = switch (mode.toLowerCase()) {
                case "car" -> "/car";
                case "transmit" -> "/transmit";
                default -> "/walk";
            };

            return base + start + "/" + end + "/-" + type + "?c=12.00,0,0,0,dh";
        } catch (UnsupportedEncodingException e) {
            throw new RuntimeException("URL 인코딩 실패", e);
        }
    }
}