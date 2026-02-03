<?php
// index.php

// Configurações de CORS e Headers
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *'); // Em produção, troque * pelo seu domínio específico
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

// Tratamento da requisição OPTIONS (Preflight)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// ================= CONFIGURAÇÕES =================
// ATENÇÃO: Mantenha suas chaves seguras. Em produção, use variáveis de ambiente.
$TOKEN = '$aact_prod_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OjYwYmFhMjRjLTNjMDYtNGM2My05YTJmLThhY2I5MmVhMDI1Mjo6JGFhY2hfZjZkNWYxYzAtMzk3ZS00ZDdlLWI2YzUtNzJjYTQwZDg0N2Y0';
$TAXA_CADASTRO = 25.90;
$CONFIRM_URL = 'https://newandrews.com.br/compraconfirmada';

// ================= FUNÇÕES AUXILIARES =================

function responderJSON($sucesso, $dados = [], $codigoHTTP = 200)
{
    http_response_code($codigoHTTP);
    echo json_encode(array_merge(['success' => $sucesso], $dados));
    exit;
}

function sanitizar($valor)
{
    return htmlspecialchars(trim($valor ?? ''), ENT_QUOTES, 'UTF-8');
}

function apenasNumeros($valor)
{
    return preg_replace('/[^0-9]/', '', $valor);
}

function validarCPFCNPJ($documento)
{
    $documento = apenasNumeros($documento);
    $len = strlen($documento);

    // Simples verificação de tamanho para não travar processamento, 
    // a API do Asaas fará a validação final rigorosa.
    return ($len === 11 || $len === 14);
}

function logErro($mensagem)
{
    // Grava no log de erros do servidor (error_log) para debug sem expor ao usuário
    error_log("[ERRO ASAAS] " . $mensagem);
}

function fazerRequisicaoAsaas($endpoint, $dados, $token, $metodo = 'POST')
{
    $ch = curl_init('https://api.asaas.com/v3' . $endpoint);

    $headers = [
        'Content-Type: application/json',
        'access_token: ' . $token,
        'User-Agent: CadastroLoja/1.0'
    ];

    $opcoes = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $metodo,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_SSL_VERIFYPEER => true // Em produção deve ser TRUE
    ];

    if ($dados !== null) {
        $opcoes[CURLOPT_POSTFIELDS] = json_encode($dados);
    }

    curl_setopt_array($ch, $opcoes);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);

    curl_close($ch);

    if ($curlError) {
        throw new Exception("Erro de conexão com Asaas: " . $curlError);
    }

    $resultado = json_decode($response, true);

    if ($httpCode >= 200 && $httpCode < 300) {
        return $resultado;
    }

    // Tenta extrair a mensagem de erro da Asaas
    $msgErro = $resultado['errors'][0]['description'] ?? 'Erro desconhecido na API Asaas';

    // Se for erro 400 e cliente já existe, retorna o erro específico para tratar
    if ($httpCode === 400 && strpos($msgErro, 'já existe') !== false) {
        throw new Exception("CLIENTE_EXISTE");
    }

    throw new Exception($msgErro);
}

function buscarClientePorCpfCnpj($cpfCnpj, $token)
{
    $cpfCnpj = apenasNumeros($cpfCnpj);
    $resultado = fazerRequisicaoAsaas("/customers?cpfCnpj={$cpfCnpj}", null, $token, 'GET');

    if (isset($resultado['data'][0]['id'])) {
        return $resultado['data'][0]['id'];
    }
    return null;
}

// ================= PROCESSAMENTO =================

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        responderJSON(false, ['message' => 'Método não permitido'], 405);
    }

    $input = file_get_contents('php://input');
    $data = json_decode($input, true);

    if (json_last_error() !== JSON_ERROR_NONE) {
        responderJSON(false, ['message' => 'JSON inválido'], 400);
    }

    // 1. Validação Básica
    $camposObrigatorios = ['nomeLoja', 'proprietario', 'documento', 'email', 'telefone', 'cep', 'rua', 'numero', 'logoUrl', 'fotoLojaUrl'];
    foreach ($camposObrigatorios as $campo) {
        if (empty($data[$campo])) {
            responderJSON(false, ['message' => "Campo obrigatório ausente: {$campo}"], 400);
        }
    }

    if (!validarCPFCNPJ($data['documento'])) {
        responderJSON(false, ['message' => 'CPF ou CNPJ inválido'], 400);
    }

    // Preparar dados do cliente
    $dadosCliente = [
        'name' => sanitizar($data['proprietario']),
        'cpfCnpj' => apenasNumeros($data['documento']),
        'email' => filter_var($data['email'], FILTER_SANITIZE_EMAIL),
        'mobilePhone' => apenasNumeros($data['telefone']),
        'address' => sanitizar($data['rua']),
        'addressNumber' => sanitizar($data['numero']),
        'complement' => sanitizar($data['complemento'] ?? ''),
        'province' => sanitizar($data['bairro'] ?? ''),
        'postalCode' => apenasNumeros($data['cep']),
        'externalReference' => 'LOJA_' . uniqid(),
        'notificationDisabled' => false,
        'observations' => "Loja: " . sanitizar($data['nomeLoja']),
        'descricaoCurta' => sanitizar($data['descCurta'] ?? ''),
        'descricaoLonga' => sanitizar($data['descLonga'] ?? '')
    ];

    // 2. Criar ou Recuperar Cliente Asaas
    $customerId = null;
    try {
        $resCliente = fazerRequisicaoAsaas('/customers', $dadosCliente, $TOKEN);
        $customerId = $resCliente['id'];
    } catch (Exception $e) {
        if ($e->getMessage() === "CLIENTE_EXISTE") {
            // Cliente já existe, buscar ID
            $customerId = buscarClientePorCpfCnpj($data['documento'], $TOKEN);
            if (!$customerId) {
                logErro("Cliente reportado como existente mas não encontrado: " . $data['documento']);
                throw new Exception("Erro ao recuperar cadastro do cliente existente.");
            }
            // Opcional: Atualizar dados do cliente se necessário
        } else {
            throw $e;
        }
    }

    // 3. Montar Descrição do Pagamento
    $descricao  = "CADASTRO LOJA: " . mb_strtoupper(sanitizar($data['nomeLoja'])) . "\n";
    $descricao .= "Resp: " . sanitizar($data['proprietario']) . "\n";
    $descricao .= "Logo: " . $data['logoUrl'] . "\n";
    $descricao .= "Vitrine: " . $data['fotoLojaUrl'] . "\n";
    $descricao .= "Descrição da Loja: " . (sanitizar($data['descricaoLonga'] ?? 'N/A')) . "\n";
    $descricao .= "Slogan: " . (sanitizar($data['descricaoCurta'] ?? 'N/A')) . "\n";

    // Cortar para 500 chars se necessário
    $descricao = substr($descricao, 0, 500);

    // 4. Criar Pagamento
    $dadosPagamento = [
        'billingType' => 'PIX',
        'customer' => $customerId,
        'value' => $TAXA_CADASTRO,
        'dueDate' => date('Y-m-d', strtotime('+3 days')),
        'description' => $descricao,
        'externalReference' => 'CAD_' . uniqid(),
        'callback' => [
            'successUrl' => $CONFIRM_URL,
            'autoRedirect' => true
        ]
    ];

    $resPagamento = fazerRequisicaoAsaas('/payments', $dadosPagamento, $TOKEN);

    // 5. Salvar Log Local (CSV)
    $arquivoCsv = __DIR__ . '/registros.csv';
    $linhaCsv = [
        date('Y-m-d H:i:s'),
        $customerId,
        $resPagamento['id'],
        sanitizar($data['nomeLoja']),
        $resPagamento['invoiceUrl'],
        'PENDENTE'
    ];

    // Adiciona cabeçalho se arquivo não existir
    if (!file_exists($arquivoCsv)) {
        file_put_contents($arquivoCsv, "Data,CustomerID,PaymentID,Loja,InvoiceURL,Status\n");
    }

    // Escrita segura (append)
    file_put_contents($arquivoCsv, implode(',', $linhaCsv) . "\n", FILE_APPEND | LOCK_EX);

    // 6. Retorno Sucesso
    responderJSON(true, [
        'message' => 'Cadastro iniciado!',
        'paymentUrl' => $resPagamento['invoiceUrl'], // Url para redirecionamento direto
        'pixCode' => $resPagamento['pixCode'] ?? null, // Copia e Cola
        'pixQrCode' => $resPagamento['encodedImage'] ?? null // Base64 da imagem
    ]);
} catch (Exception $e) {
    logErro($e->getMessage());
    responderJSON(false, ['message' => 'Erro ao processar: ' . $e->getMessage()], 400);
}
