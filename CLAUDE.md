# Claude Code Instructions для проекта Furnimaster

## Обязательные действия при начале работы
1. **ВСЕГДА проверяй memory в начале сессии**: `mcp__memory__read_graph`
2. Проверяй актуальную информацию о проекте в memory
3. При необходимости обновляй информацию в memory

## Информация о проекте
- **Тип**: Лендинг мастерской швейной фурнитуры
- **Технологии**: Vanilla JS (без фреймворков), PHP для email
- **Деплой**: FTP через deploy_ftp.js
- **Структура**: index.html, script.js, styles.css, send-email.php + папки fonts/, icons/, images/, dist/

## Команды для тестирования
- Линтинг: (определить при необходимости)
- Типы: (не применимо для Vanilla JS)
- Сборка: (определить при необходимости)

## Контекст memory
Вся информация о проекте должна храниться в memory системе для переиспользования между сессиями.