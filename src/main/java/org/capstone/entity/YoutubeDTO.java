package org.capstone.entity;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class YoutubeDTO {
    private String title;
    private String thumbnailUrl;
    private String videoUrl;
    private String publishedAt;
    private String channelTitle;
    private String viewCount;
}
