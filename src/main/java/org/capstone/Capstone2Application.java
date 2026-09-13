package org.capstone;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.web.servlet.ServletComponentScan;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@ServletComponentScan
@SpringBootApplication
@EnableJpaRepositories(basePackages = "org.capstone.repository")
@EntityScan(basePackages = "org.capstone.entity")
public class Capstone2Application {
    public static void main(String[] args) {
        SpringApplication.run(Capstone2Application.class, args);
    }
}
