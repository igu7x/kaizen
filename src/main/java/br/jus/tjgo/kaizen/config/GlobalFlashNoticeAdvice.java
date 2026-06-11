package br.jus.tjgo.kaizen.config;

import br.jus.tjgo.kaizen.util.Flash;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyAdvice;

@ControllerAdvice
public class GlobalFlashNoticeAdvice implements ResponseBodyAdvice<Object> {

    @Override
    public boolean supports(MethodParameter returnType, Class converterType) {
        return true;
    }

    @Override
    public Object beforeBodyWrite(Object body, MethodParameter returnType, MediaType selectedContentType,
                                  Class selectedConverterType, ServerHttpRequest request, ServerHttpResponse response) {
        
        HttpMethod method = request.getMethod();
        
        // Aplica interceptação genérica de sucesso apenas para rotas que alteram estado
        if (method == HttpMethod.POST || method == HttpMethod.PUT || method == HttpMethod.DELETE) {
            
            if (response instanceof org.springframework.http.server.ServletServerHttpResponse) {
                int status = ((org.springframework.http.server.ServletServerHttpResponse) response).getServletResponse().getStatus();
                
                // Apenas se a operação foi bem sucedida
                if (status >= 200 && status < 300) {
                    
                    // Verifica se o controller JÁ enviou um aviso customizado (para não sobrescrever o particular)
                    if (!response.getHeaders().containsKey("X-Flash-Success") && 
                        !response.getHeaders().containsKey("X-Flash-Notice") && 
                        !response.getHeaders().containsKey("X-Flash-Error")) {
                        
                        String message = null;
                        if (method == HttpMethod.POST) {
                            message = "Criação bem-sucedida!";
                        } else if (method == HttpMethod.PUT) {
                            message = "Atualização bem-sucedida!";
                        } else if (method == HttpMethod.DELETE) {
                            message = "Remoção bem-sucedida!";
                        }
                        
                        if (message != null) {
                            response.getHeaders().add("X-Flash-Success", Flash.encode(message));
                        }
                    }
                }
            }
        }
        
        return body;
    }
}
