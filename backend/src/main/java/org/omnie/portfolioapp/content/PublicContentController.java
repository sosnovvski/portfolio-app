package org.omnie.portfolioapp.content;

import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import org.omnie.portfolioapp.common.error.ApiProblem;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/public")
class PublicContentController {

    private final PublicContentService service;

    PublicContentController(PublicContentService service) {
        this.service = service;
    }

    @GetMapping(path = "/content/{locale:en|pl}", produces = MediaType.APPLICATION_JSON_VALUE)
    @ApiResponse(responseCode = "200", description = "Published content in one language")
    @ApiResponse(responseCode = "404", description = "Unsupported language, or no profile yet",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
                    schema = @Schema(implementation = ApiProblem.class)))
    PublicContent content(
            @Parameter(schema = @Schema(allowableValues = {"en", "pl"})) @PathVariable String locale) {
        return service.load(Language.fromPath(locale));
    }
}
