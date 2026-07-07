package br.jus.tjgo.kaizen.auth;

import br.jus.tjgo.kaizen.service.PermissoesAcoesService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class PermissoesAcoesInterceptor implements HandlerInterceptor {

    private final PermissoesAcoesService permissoesAcoesService;

    public PermissoesAcoesInterceptor(PermissoesAcoesService permissoesAcoesService) {
        this.permissoesAcoesService = permissoesAcoesService;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        
        if (handler instanceof HandlerMethod handlerMethod) {
            TagAcao classTag = handlerMethod.getBeanType().getAnnotation(TagAcao.class);
            TagAcao methodTag = handlerMethod.getMethodAnnotation(TagAcao.class);
            
            if (classTag != null || methodTag != null) {
                Long userId = AuthContext.requestUserId();
                
                if (userId == null || userId == 0) {
                    response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Usuário não autenticado");
                    return false;
                }
                
                if (classTag != null && !validateTag(classTag, userId)) {
                    response.sendError(HttpServletResponse.SC_FORBIDDEN, "Acesso negado a este recurso (Restrição de Módulo).");
                    return false;
                }
                
                if (methodTag != null && !validateTag(methodTag, userId)) {
                    response.sendError(HttpServletResponse.SC_FORBIDDEN, "Acesso negado a esta ação específica.");
                    return false;
                }
            }
        }
        
        return true;
    }

    private boolean validateTag(TagAcao tagAcao, Long userId) {
        boolean hasAccess = tagAcao.logical() == TagAcao.Logical.ALL;
        
        for (String tag : tagAcao.value()) {
            boolean tagAcesso = permissoesAcoesService.validarAcesso(userId, tag);
            
            if (tagAcao.logical() == TagAcao.Logical.ANY) {
                if (tagAcesso) {
                    hasAccess = true;
                    break;
                }
            } else {
                if (!tagAcesso) {
                    hasAccess = false;
                    break;
                }
            }
        }
        return hasAccess;
    }
}
