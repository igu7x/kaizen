package br.jus.tjgo.kaizen.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.TaskExecutor;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * Habilita execução assíncrona (usada pelo envio de e-mail de notificações, para não somar a
 * latência do SMTP ao tempo de resposta das ações). Pool pequeno e dedicado.
 */
@Configuration
@EnableAsync
public class AsyncConfig {

    @Bean(name = "notificacaoExecutor")
    public TaskExecutor notificacaoExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(4);
        executor.setQueueCapacity(500);
        executor.setThreadNamePrefix("notif-");
        executor.initialize();
        return executor;
    }
}
