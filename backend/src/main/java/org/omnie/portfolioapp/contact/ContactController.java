package org.omnie.portfolioapp.contact;

import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import org.omnie.portfolioapp.common.error.ApiProblem;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
class ContactController {

    record ReadUpdate(@NotNull Boolean read) {
    }

    private final ContactService service;

    ContactController(ContactService service) {
        this.service = service;
    }

    /** Validation runs inside the service, after the honeypot check, so a bot cannot tell the paths apart. */
    @PostMapping("/api/public/contact")
    @ResponseStatus(HttpStatus.ACCEPTED)
    @ApiResponse(responseCode = "202", description = "Accepted")
    @ApiResponse(responseCode = "400", description = "Some fields are not valid",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ApiProblem.class)))
    @ApiResponse(responseCode = "429", description = "Too many messages. See the Retry-After header",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ApiProblem.class)))
    void submit(@RequestBody ContactForm form, HttpServletRequest request) {
        service.submit(form, request.getRemoteAddr());
    }

    @GetMapping("/api/admin/messages")
    MessagePage messages(@RequestParam(defaultValue = "0") @Min(0) int page,
                         @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return service.list(page, size);
    }

    @PatchMapping("/api/admin/messages/{id}")
    MessageView setRead(@PathVariable long id, @Valid @RequestBody ReadUpdate update) {
        return service.setRead(id, update.read());
    }

    @DeleteMapping("/api/admin/messages/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@PathVariable long id) {
        service.delete(id);
    }
}
