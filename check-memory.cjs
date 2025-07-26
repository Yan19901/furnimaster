#!/usr/bin/env node

/**
 * Hook script для автоматической проверки memory при начале сессии Claude Code
 * Используется в настройках hooks
 */

const fs = require('fs');
const path = require('path');

function main() {
    try {
        // Получаем данные от Claude Code hook
        const input = process.argv[2] ? JSON.parse(process.argv[2]) : {};
        
        // Определяем текущую директорию
        const currentDir = process.cwd();
        
        // Проверяем есть ли CLAUDE.md в текущем проекте
        const claudeMdPath = path.join(currentDir, 'CLAUDE.md');
        
        if (fs.existsSync(claudeMdPath)) {
            console.log('📋 НАПОМИНАНИЕ: Проверь memory для этого проекта - выполни mcp__memory__read_graph');
            console.log(`📁 Проект: ${path.basename(currentDir)}`);
            console.log(`📄 Найден CLAUDE.md: ${claudeMdPath}`);
        } else {
            console.log('ℹ️  Для полной информации о проекте рекомендуется проверить memory');
        }
        
        // Возвращаем успешный статус
        process.exit(0);
        
    } catch (error) {
        console.error('Ошибка в check-memory hook:', error.message);
        process.exit(0); // Не блокируем Claude Code при ошибке
    }
}

if (require.main === module) {
    main();
}

module.exports = { main };