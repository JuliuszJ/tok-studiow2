package pl.dziekanat.zaliczenie_semestru;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
@io.camunda.client.annotation.Deployment(resources = {
        "classpath*:*.bpmn",
        "classpath*:*.form",
        "classpath*:*.dmn"
})
public class ZaliczenieSemestruApplication {

	public static void main(String[] args) {
		SpringApplication.run(ZaliczenieSemestruApplication.class, args);
	}

}
