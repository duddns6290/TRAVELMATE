package org.capstone.service;

import com.lowagie.text.pdf.BaseFont;
import lombok.RequiredArgsConstructor;
import org.capstone.entity.daySchedule.DayScheduleDTO;
import org.capstone.entity.daySchedule.PlaceDTO;
import org.capstone.entity.daySchedule.TravelWithPlacesDTO;
import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.xhtmlrenderer.pdf.ITextRenderer;
import org.springframework.core.io.Resource;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.io.File;

import jakarta.servlet.http.HttpServletResponse;

import org.thymeleaf.context.Context;
import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.TreeMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PDF_Service {

    private final TemplateEngine templateEngine;
    private final TravelService travelService;

    public String renderHtml(String templatePath, Map<String, Object> data) {
         Context context = new Context();
         context.setVariables(data);
         return templateEngine.process(templatePath, context);
     }

    public String renderTravelHtmlForPdf(Long travelId) {
        TravelWithPlacesDTO dto = travelService.getTravelWithPlaces(travelId); // ← 여기서 호출!
        LocalDate startDate = LocalDate.parse(dto.getStartDate());
        // 일차별로
        Map<Integer, List<PlaceDTO>> grouped = dto.getPlaces().stream()
            .collect(Collectors.groupingBy(
                PlaceDTO::getSelectedDay,
                TreeMap::new,
                Collectors.toList()
            ));

        List<DayScheduleDTO> scheduleList = new ArrayList<>();
        for (Map.Entry<Integer, List<PlaceDTO>> entry : grouped.entrySet()) {
            int day = entry.getKey();
            String dateStr = startDate.plusDays(day - 1).toString();
            scheduleList.add(new DayScheduleDTO(day, dateStr, entry.getValue()));
        }
        Map<String, Object> model = new HashMap<>();
        model.put("travelName", dto.getTravelName());
        model.put("startDate", dto.getStartDate());
        model.put("endDate", dto.getEndDate());
        model.put("scheduleList", scheduleList);
        return renderHtml("pdf/timetable", model);
    }

    public Resource generateTravelPdf(int travelId) throws Exception {
        return null;
    }

    public void exportToPdf(HttpServletResponse response, String htmlContent) {
        try {
            System.out.println("[PDF] 받은 HTML 길이: " + (htmlContent != null ? htmlContent.length() : "null"));

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            ITextRenderer renderer = new ITextRenderer();

            try (InputStream fontStream = getClass().getClassLoader().getResourceAsStream("fonts/NanumGothic.ttf"))
            {
            if (fontStream == null) {
                throw new IllegalStateException("폰트 InputStream을 불러올 수 없습니다.");
            }
                File tempFontFile = File.createTempFile("NanumGothic", ".ttf");
                Files.copy(fontStream, tempFontFile.toPath(), StandardCopyOption.REPLACE_EXISTING);

                renderer.getFontResolver().addFont(
                    tempFontFile.getAbsolutePath(), BaseFont.IDENTITY_H, BaseFont.EMBEDDED
                );
            }
            renderer.setDocumentFromString(htmlContent);
            renderer.layout();
            renderer.createPDF(baos, false);
            renderer.finishPDF();

            response.setContentType("application/pdf");
            response.setHeader("Content-Disposition", "attachment; filename=timetable.pdf");
            response.setContentLength(baos.size());
            baos.writeTo(response.getOutputStream());
        } catch (Exception e) {
            throw new RuntimeException("PDF 생성 중 오류 발생", e);
        }
    }
}
