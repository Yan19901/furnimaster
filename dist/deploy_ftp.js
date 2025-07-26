import ftp from 'basic-ftp';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

// Файлы и папки, которые НЕ должны попадать на хостинг
const EXCLUDED_FILES = [
    'deploy_ftp.js',
    '.claude',
    'CLAUDE.md',
    'check-memory.cjs',
    'package.json',
    'package-lock.json',
    '.env',
    '.git',
    '.gitignore',
    'node_modules',
    '.vscode',
    '.DS_Store',
    'Thumbs.db'
];

// Функция для проверки, должен ли файл быть исключен
function shouldExclude(filePath) {
    const fileName = path.basename(filePath);
    return EXCLUDED_FILES.some(excluded => 
        fileName === excluded || 
        fileName.startsWith('.') && excluded.startsWith('.') ||
        filePath.includes(excluded)
    );
}

// Функция для загрузки файлов с фильтрацией
async function uploadFilteredFiles(client, localPath, remotePath) {
    const files = fs.readdirSync(localPath, { withFileTypes: true });
    
    for (const file of files) {
        const localFilePath = path.join(localPath, file.name);
        const remoteFilePath = path.posix.join(remotePath, file.name);
        
        // Проверяем, нужно ли исключить файл
        if (shouldExclude(localFilePath)) {
            console.log(`⏭️  Skipping: ${file.name} (excluded)`);
            continue;
        }
        
        if (file.isDirectory()) {
            console.log(`📁 Creating directory: ${file.name}`);
            await client.ensureDir(remoteFilePath);
            await uploadFilteredFiles(client, localFilePath, remoteFilePath);
        } else {
            console.log(`📄 Uploading: ${file.name}`);
            await client.uploadFrom(localFilePath, remoteFilePath);
        }
    }
}

// Загружаем переменные из .env
dotenv.config();

async function syncDistFolder() {
    console.log('📦 Syncing dist folder with latest changes...');
    
    try {
        // Определяем базовую директорию и целевую папку dist
        const currentDir = process.cwd();
        const isInDist = currentDir.endsWith('dist');
        const baseDir = isInDist ? path.join(currentDir, '..') : currentDir;
        const distDir = path.join(baseDir, 'dist');
        
        // Копируем актуальные файлы в dist
        const filesToSync = [
            { src: path.join(baseDir, 'index.html'), dest: path.join(distDir, 'index.html') },
            { src: path.join(baseDir, 'styles.css'), dest: path.join(distDir, 'styles.css') },
            { src: path.join(baseDir, 'script.js'), dest: path.join(distDir, 'script.js') },
            { src: path.join(baseDir, 'send-email.php'), dest: path.join(distDir, 'send-email.php') }
        ];
        
        for (const file of filesToSync) {
            if (fs.existsSync(file.src)) {
                fs.copyFileSync(file.src, file.dest);
                console.log(`✅ Synced: ${file.src} → ${file.dest}`);
            }
        }
        
        // Копируем папки если они существуют
        const foldersToSync = ['fonts', 'images'];
        for (const folder of foldersToSync) {
            const srcFolder = path.join(baseDir, folder);
            const destFolder = path.join(distDir, folder);
            
            if (fs.existsSync(srcFolder)) {
                // Создаем папку если не существует
                if (!fs.existsSync(destFolder)) {
                    fs.mkdirSync(destFolder, { recursive: true });
                }
                
                // Копируем содержимое
                try {
                    execSync(`xcopy "${srcFolder}" "${destFolder}" /E /I /Y`, { stdio: 'pipe' });
                    console.log(`✅ Synced folder: ${folder}`);
                } catch (error) {
                    console.log(`ℹ️  Folder ${folder} sync completed with warnings`);
                }
            }
        }
        
        console.log('✅ Dist folder synchronized successfully!');
        
    } catch (error) {
        console.error('❌ Error syncing dist folder:', error.message);
        throw error;
    }
}

async function deployToFTP() {
    const client = new ftp.Client();
    
    // Показываем прогресс загрузки
    client.ftp.verbose = true;
    
    try {
        // Сначала синхронизируем dist папку
        await syncDistFolder();
        
        console.log('🚀 Starting FTP deployment...');
        
        // Подключение к FTP серверу
        await client.access({
            host: process.env.FTP_HOST,
            port: parseInt(process.env.FTP_PORT) || 21,
            user: process.env.FTP_USER,
            password: process.env.FTP_PASSWORD,
            secure: process.env.FTP_SECURE === 'true'
        });
        
        console.log('✅ Connected to FTP server:', process.env.FTP_HOST);
        
        // Определяем локальную папку для загрузки
        const localPath = process.env.FTP_LOCAL_PATH || './dist';
        const remotePath = process.env.FTP_REMOTE_PATH || '/public_html/';
        
        // Проверяем существует ли локальная папка
        if (!fs.existsSync(localPath)) {
            throw new Error(`Local directory ${localPath} does not exist. Did you run build command?`);
        }
        
        console.log(`📁 Uploading from: ${localPath}`);
        console.log(`📁 Uploading to: ${remotePath}`);
        
        // Переходим в удаленную директорию
        await client.ensureDir(remotePath);
        
        // Очищаем удаленную директорию от старых файлов
        console.log('🧹 Clearing remote directory...');
        try {
            const list = await client.list();
            for (const item of list) {
                if (item.name !== '.' && item.name !== '..' && item.name !== 'cgi-bin') {
                    try {
                        if (item.type === 2) { // directory
                            console.log(`🗂️  Removing directory: ${item.name}`);
                            await client.removeDir(item.name);
                        } else { // file
                            console.log(`🗃️  Removing file: ${item.name}`);
                            await client.remove(item.name);
                        }
                    } catch (err) {
                        console.log(`⚠️  Could not remove ${item.name}:`, err.message);
                    }
                }
            }
            console.log('✅ Remote directory cleared');
        } catch (error) {
            console.log('ℹ️  Could not clear directory:', error.message);
        }

        // Загружаем файлы с фильтрацией
        console.log('📤 Uploading files with filtering...');
        await uploadFilteredFiles(client, localPath, remotePath);
        
        console.log('🎉 Deployment completed successfully!');
        console.log(`🌐 Your site should be available at: ${process.env.SITE_URL || 'your-website.com'}`);
        
    } catch (error) {
        console.error('❌ Deployment failed:', error.message);
        process.exit(1);
    } finally {
        client.close();
    }
}

// Запускаем деплой
deployToFTP().catch(error => {
    console.error('❌ Deployment process failed:', error.message);
    process.exit(1);
});