<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// Проверяем метод запроса
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Метод не разрешен']);
    exit;
}

// Получаем данные из формы
$name = isset($_POST['name']) ? trim($_POST['name']) : '';
$phone = isset($_POST['phone']) ? trim($_POST['phone']) : '';
$email = isset($_POST['email']) ? trim($_POST['email']) : '';
$message = isset($_POST['message']) ? trim($_POST['message']) : '';

// Валидация обязательных полей
if (empty($name) || empty($phone) || empty($message)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Заполните все обязательные поля']);
    exit;
}

// Валидация телефона
if (!preg_match('/^[\+]?[7-8][\s\-]?\(?[0-9]{3}\)?[\s\-]?[0-9]{3}[\s\-]?[0-9]{2}[\s\-]?[0-9]{2}$/', $phone)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Некорректный номер телефона']);
    exit;
}

// Валидация email (если указан)
if (!empty($email) && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Некорректный email адрес']);
    exit;
}

// Параметры отправки
$to = 'yan@blanh.ru';
$subject = 'ФурниМастер - Новое сообщение с сайта';

// Формируем текст письма
$email_body = "
Новое сообщение с сайта ФурниМастер

Имя: $name
Телефон: $phone
Email: " . ($email ? $email : 'не указан') . "

Сообщение:
$message

---
Сообщение отправлено с сайта furnimaster.ru
Дата: " . date('d.m.Y H:i:s') . "
IP: " . $_SERVER['REMOTE_ADDR'] . "
";

// HTML версия письма
$email_html = "
<!DOCTYPE html>
<html>
<head>
    <meta charset='UTF-8'>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #667eea; color: white; padding: 20px; text-align: center; }
        .content { background: #f9f9f9; padding: 20px; }
        .field { margin-bottom: 15px; }
        .label { font-weight: bold; color: #555; }
        .value { margin-top: 5px; }
        .message-box { background: white; padding: 15px; border-left: 4px solid #667eea; margin-top: 15px; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class='container'>
        <div class='header'>
            <h2>ФурниМастер - Новое сообщение</h2>
        </div>
        <div class='content'>
            <div class='field'>
                <div class='label'>Имя:</div>
                <div class='value'>$name</div>
            </div>
            <div class='field'>
                <div class='label'>Телефон:</div>
                <div class='value'>$phone</div>
            </div>
            <div class='field'>
                <div class='label'>Email:</div>
                <div class='value'>" . ($email ? $email : 'не указан') . "</div>
            </div>
            <div class='message-box'>
                <div class='label'>Сообщение:</div>
                <div class='value'>" . nl2br(htmlspecialchars($message)) . "</div>
            </div>
        </div>
        <div class='footer'>
            Сообщение отправлено с сайта furnimaster.ru<br>
            " . date('d.m.Y H:i:s') . " | IP: " . $_SERVER['REMOTE_ADDR'] . "
        </div>
    </div>
</body>
</html>
";

// Заголовки письма
$headers = [
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'From: noreply@furnimaster.ru',
    'Reply-To: ' . ($email ? $email : 'noreply@furnimaster.ru'),
    'X-Mailer: PHP/' . phpversion(),
    'X-Priority: 3'
];

// Отправляем письмо
if (mail($to, $subject, $email_html, implode("\r\n", $headers))) {
    echo json_encode([
        'success' => true, 
        'message' => 'Сообщение успешно отправлено! Мы свяжемся с вами в ближайшее время.'
    ]);
} else {
    http_response_code(500);
    echo json_encode([
        'success' => false, 
        'message' => 'Ошибка при отправке сообщения. Попробуйте позже или свяжитесь с нами по телефону.'
    ]);
}
?>