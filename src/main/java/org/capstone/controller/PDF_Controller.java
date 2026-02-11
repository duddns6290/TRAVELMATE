package org.capstone.controller;

import lombok.RequiredArgsConstructor;
import org.capstone.service.PDF_Service;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.HttpServletResponse;

@RestController
@RequiredArgsConstructor
@RequestMapping("/pdf")
public class PDF_Controller {

    private final PDF_Service pdfService;

    @GetMapping("/travel/{id}/timetable")
    public void exportPdf(@PathVariable Long id, HttpServletResponse response) {
        String html = pdfService.renderTravelHtmlForPdf(id);
        pdfService.exportToPdf(response, html);
    }
}
