import React, { useState, useEffect } from "react";
import styles from "./RegisterStore.module.css";
import {
  Check,
  Camera,
  Upload,
  ArrowRight,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { PatternFormat } from "react-number-format";

// --- CONFIGURAÇÃO DA API ---
const API_ENDPOINT = "https://www.newandrews.com.br/checkout-asaas/index.php";

// --- FUNÇÕES AUXILIARES DE VALIDAÇÃO ---

// Valida CPF ou CNPJ (Matemática rigorosa)
const isValidCpfCnpj = (val) => {
  if (!val) return false;
  const clean = val.replace(/\D/g, "");

  // CPF (11 dígitos)
  if (clean.length === 11) {
    if (/^(\d)\1+$/.test(clean)) return false;
    let soma = 0, resto;
    for (let i = 1; i <= 9; i++) soma += parseInt(clean.substring(i - 1, i)) * (11 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(clean.substring(9, 10))) return false;
    soma = 0;
    for (let i = 1; i <= 10; i++) soma += parseInt(clean.substring(i - 1, i)) * (12 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(clean.substring(10, 11))) return false;
    return true;
  }

  // CNPJ (14 dígitos)
  if (clean.length === 14) {
    if (/^(\d)\1+$/.test(clean)) return false;
    let tamanho = clean.length - 2;
    let numeros = clean.substring(0, tamanho);
    let digitos = clean.substring(tamanho);
    let soma = 0, pos = tamanho - 7;
    for (let i = tamanho; i >= 1; i--) {
      soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    if (resultado !== parseInt(digitos.charAt(0))) return false;

    tamanho = tamanho + 1;
    numeros = clean.substring(0, tamanho);
    soma = 0;
    pos = tamanho - 7;
    for (let i = tamanho; i >= 1; i--) {
      soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    if (resultado !== parseInt(digitos.charAt(1))) return false;
    return true;
  }
  return false;
};

// Validação de E-mail (Regex Padrão)
const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).toLowerCase());
};

// Validação de Telefone (10 ou 11 dígitos numéricos)
const isValidPhone = (phone) => {
  if (!phone) return false;
  const clean = phone.replace(/\D/g, "");
  return clean.length >= 10 && clean.length <= 11;
};

const RegisterStore = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loadingCep, setLoadingCep] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState(null);

  // Previews de imagem
  const [logoPreview, setLogoPreview] = useState(null);
  const [fotoLojaPreview, setFotoLojaPreview] = useState(null);

  const [formData, setFormData] = useState({
    nomeLoja: "",
    cep: "",
    rua: "",
    numero: "",
    complemento: "",
    bairro: "",
    email: "",
    telefone: "",
    proprietario: "",
    documento: "", // CPF ou CNPJ
    descCurta: "",
    descLonga: "",
    logo: null,
    fotoLoja: null,
  });

  // --- BUSCA CEP ---
  const handleCepChange = async (e) => {
    const valor = e.target.value;
    const cepLimpo = valor.replace(/\D/g, "");

    setFormData((prev) => ({ ...prev, cep: valor }));

    // Reseta campos se apagar o CEP
    if (cepLimpo.length < 8) {
       setFormData(prev => ({...prev, rua: "", bairro: ""}));
    }

    if (cepLimpo.length === 8) {
      setLoadingCep(true);
      setSubmitError(null);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
        const data = await res.json();
        
        if (data.erro) {
          setSubmitError("CEP não encontrado. Verifique os números.");
          setFormData((prev) => ({ ...prev, rua: "", bairro: "" }));
        } else {
          setFormData((prev) => ({
            ...prev,
            rua: data.logradouro,
            complemento: data.complemento || prev.complemento,
            bairro: data.bairro || prev.bairro,
            // Cidade e UF podem ser salvos aqui se o seu backend aceitar,
            // mas mantive apenas o que seu código original enviava.
          }));
          setSubmitError(null); // Limpa erro se sucesso
        }
      } catch (err) {
        console.error(err);
        setSubmitError("Erro ao buscar CEP. Verifique sua conexão.");
      } finally {
        setLoadingCep(false);
      }
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e, fieldName, setPreviewFn) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith("image/")) {
      setFormData((prev) => ({ ...prev, [fieldName]: file }));
      const previewUrl = URL.createObjectURL(file);
      setPreviewFn(previewUrl);
    }
  };

  // --- VALIDAÇÃO DE NAVEGAÇÃO ENTRE ETAPAS ---
  const handleNextStep = () => {
    setSubmitError(null);

    // Validação ETAPA 1
    if (currentStep === 1) {
      if (formData.nomeLoja.trim().length < 3) {
        setSubmitError("O nome da loja deve ter pelo menos 3 caracteres.");
        return;
      }
      if (!formData.logo) {
        setSubmitError("Por favor, faça o upload da logo da loja.");
        return;
      }
    }

    // Validação ETAPA 2 (Endereço)
    if (currentStep === 2) {
      const cleanCep = formData.cep.replace(/\D/g, "");
      if (cleanCep.length !== 8) {
        setSubmitError("Digite um CEP válido.");
        return;
      }
      if (!formData.rua) {
        setSubmitError("Endereço não preenchido. Digite um CEP válido para buscar.");
        return;
      }
      if (!formData.numero.trim()) {
        setSubmitError("Por favor, informe o número do endereço.");
        return;
      }
    }

    // Validação ETAPA 3 (Contato/Documento)
    if (currentStep === 3) {
      if (formData.proprietario.trim().length < 3) {
        setSubmitError("Informe o nome completo do proprietário.");
        return;
      }
      
      if (!isValidCpfCnpj(formData.documento)) {
        setSubmitError("CPF ou CNPJ inválido. Verifique os dígitos.");
        return;
      }

      if (!isValidEmail(formData.email)) {
        setSubmitError("E-mail inválido. Ex: nome@empresa.com");
        return;
      }

      if (!isValidPhone(formData.telefone)) {
        setSubmitError("Telefone inválido. Digite DDD + Número (ex: 11999999999).");
        return;
      }
    }

    // Se tudo ok, avança
    setCurrentStep((prev) => prev + 1);
  };

  // --- SUBMIT FINAL ---
  const handleSubmit = async () => {
    setSubmitError(null);
    
    // Validação ETAPA 4
    if (formData.descCurta.trim().length < 5) {
      setSubmitError("O slogan deve ter pelo menos 5 caracteres.");
      return;
    }
    if (formData.descLonga.trim().length < 10) {
      setSubmitError("A descrição deve ser mais detalhada.");
      return;
    }
    if (!formData.fotoLoja) {
      setSubmitError("Adicione uma foto da sua vitrine/loja.");
      return;
    }

    setLoadingSubmit(true);

    try {
      const dataToSend = new FormData();
      const cleanCep = formData.cep.replace(/\D/g, "");
      const cleanPhone = formData.telefone.replace(/\D/g, "");
      const cleanDoc = formData.documento.replace(/\D/g, "");

      dataToSend.append("nomeLoja", formData.nomeLoja);
      dataToSend.append("cep", cleanCep);
      dataToSend.append("rua", formData.rua);
      dataToSend.append("numero", formData.numero);
      dataToSend.append("complemento", formData.complemento);
      dataToSend.append("bairro", formData.bairro);
      dataToSend.append("email", formData.email);
      dataToSend.append("telefone", cleanPhone);
      dataToSend.append("proprietario", formData.proprietario);
      dataToSend.append("documento", cleanDoc);
      dataToSend.append("descCurta", formData.descCurta);
      dataToSend.append("descLonga", formData.descLonga);

      if (formData.logo instanceof File) dataToSend.append("logo", formData.logo);
      if (formData.fotoLoja instanceof File) dataToSend.append("fotoLoja", formData.fotoLoja);

      const response = await fetch(API_ENDPOINT, {
        method: "POST",
        body: dataToSend,
      });

      const textResult = await response.text();
      let result;
      try {
        result = JSON.parse(textResult);
      } catch (e) {
        console.error("Resposta não-JSON:", textResult);
        throw new Error("O servidor retornou uma resposta inválida.");
      }

      if (response.ok && (result.success || result.paymentUrl)) {
        setSubmitSuccess(true);
        const finalUrl = result.paymentUrl || result.url;
        setPaymentUrl(finalUrl);
        if (finalUrl) {
          setTimeout(() => { window.location.href = finalUrl; }, 2500);
        }
      } else {
        const msg = result.errors ? result.errors.join(", ") : result.message || "Erro ao processar cadastro.";
        setSubmitError(msg);
      }
    } catch (error) {
      setSubmitError(error.message || "Erro de conexão. Tente novamente.");
    } finally {
      setLoadingSubmit(false);
    }
  };

  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
      if (fotoLojaPreview) URL.revokeObjectURL(fotoLojaPreview);
    };
  }, [logoPreview, fotoLojaPreview]);

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {/* SIDEBAR */}
        <aside className={styles.sidebar}>
          <div className={styles.brand}>Anuncia Já</div>
          <h2 className={styles.sidebarTitle}>Criar conta</h2>
          <div className={styles.stepsContainer}>
            {[1, 2, 3, 4].map((num) => (
              <div
                key={num}
                className={`${styles.stepItem} ${currentStep >= num ? styles.stepActive : ""}`}
              >
                <div className={`${styles.stepNumber} ${currentStep >= num ? styles.stepNumberActive : ""}`}>
                  {currentStep > num ? <Check size={14} /> : num}
                </div>
                <span>
                  {num === 1 ? "Loja" : num === 2 ? "Local" : num === 3 ? "Contato" : "Vitrine"}
                </span>
              </div>
            ))}
          </div>
        </aside>

        {/* CONTEÚDO */}
        <main className={styles.content}>
          <div className={styles.headerArea}>
            <h3 className={styles.stepTitle}>
              {currentStep === 1 && "Identidade da Loja"}
              {currentStep === 2 && "Onde te encontram?"}
              {currentStep === 3 && "Responsável e Contato"}
              {currentStep === 4 && "Sua Vitrine"}
            </h3>
          </div>

          {submitError && (
            <div className={styles.errorMessage}>⚠️ {submitError}</div>
          )}

          {submitSuccess && paymentUrl && (
            <div className={styles.successMessage}>
              ✅ Cadastro realizado! Redirecionando para pagamento...
            </div>
          )}

          <div className={styles.scrollWindow}>
            {/* STEP 1 - LOJA */}
            {currentStep === 1 && (
              <>
                <div className={styles.inputGroup}>
                  <label>Nome da Empresa *</label>
                  <input
                    name="nomeLoja"
                    className={styles.input}
                    value={formData.nomeLoja}
                    onChange={handleChange}
                    placeholder="Ex: Mercado Central"
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label>Logo da Empresa *</label>
                  <input
                    type="file"
                    id="logo-upload"
                    className={styles.hiddenInput}
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, "logo", setLogoPreview)}
                  />
                  <label htmlFor="logo-upload" className={styles.fileUploadLabel}>
                    {logoPreview ? (
                      <div style={{ textAlign: "center" }}>
                        <img
                          src={logoPreview}
                          alt="Logo Preview"
                          style={{ maxHeight: "150px", borderRadius: "8px", marginBottom: "10px" }}
                        />
                        <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Clique para trocar</div>
                      </div>
                    ) : (
                      <div className={styles.placeholderContent}>
                        <Upload size={32} />
                        <div>Clique para adicionar sua logo</div>
                      </div>
                    )}
                  </label>
                </div>
              </>
            )}

            {/* STEP 2 - LOCAL (Com ViaCEP Obrigatório) */}
            {currentStep === 2 && (
              <>
                <div className={styles.flexRow}>
                  <div className={styles.colHalf}>
                    <label>
                      CEP * {loadingCep && <Loader2 size={12} className="animate-spin" />}
                    </label>
                    <PatternFormat
                      format="#####-###"
                      name="cep"
                      className={styles.input}
                      value={formData.cep}
                      onChange={handleCepChange}
                      placeholder="00000-000"
                    />
                  </div>
                  <div className={styles.colHalf}>
                    <label>Número *</label>
                    <input
                      name="numero"
                      className={styles.input}
                      value={formData.numero}
                      onChange={handleChange}
                      placeholder="Nº"
                    />
                  </div>
                </div>
                
                <div className={styles.inputGroup}>
                  <label>Rua (Preenchimento Automático) *</label>
                  <input
                    name="rua"
                    className={styles.input}
                    value={formData.rua}
                    readOnly // BLOQUEADO
                    tabIndex={-1}
                    placeholder="Preencha o CEP para buscar"
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label>Bairro (Preenchimento Automático) *</label>
                  <input
                    name="bairro"
                    className={styles.input}
                    value={formData.bairro}
                    readOnly // BLOQUEADO
                    tabIndex={-1}
                    placeholder="Preencha o CEP para buscar"
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label>Complemento</label>
                  <input
                    name="complemento"
                    className={styles.input}
                    value={formData.complemento}
                    onChange={handleChange}
                    placeholder="Ex: Sala 2"
                  />
                </div>
              </>
            )}

            {/* STEP 3 - CONTATO E DOCUMENTO */}
            {currentStep === 3 && (
              <>
                <div className={styles.inputGroup}>
                  <label>Nome do Proprietário *</label>
                  <input
                    name="proprietario"
                    className={styles.input}
                    value={formData.proprietario}
                    onChange={handleChange}
                    placeholder="Nome completo"
                  />
                </div>
                
                <div className={styles.inputGroup}>
                  <label>CPF ou CNPJ *</label>
                  <PatternFormat
                    // Lógica para alternar máscara baseada no tamanho atual
                    format={formData.documento.replace(/\D/g, "").length > 11 ? "##.###.###/####-##" : "###.###.###-#####"}
                    name="documento"
                    className={styles.input}
                    value={formData.documento}
                    onValueChange={(values) => {
                      setFormData(prev => ({ ...prev, documento: values.value }))
                    }}
                    placeholder="Digite CPF ou CNPJ"
                    mask="_"
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label>E-mail *</label>
                  <input
                    type="email"
                    name="email"
                    className={styles.input}
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="email@exemplo.com"
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label>Telefone / WhatsApp *</label>
                  <PatternFormat
                    format="(##) #####-####"
                    name="telefone"
                    className={styles.input}
                    value={formData.telefone}
                    onChange={handleChange}
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </>
            )}

            {/* STEP 4 - VITRINE */}
            {currentStep === 4 && (
              <>
                <div className={styles.inputGroup}>
                  <label>Slogan (Descrição Curta) *</label>
                  <input
                    name="descCurta"
                    className={styles.input}
                    value={formData.descCurta}
                    onChange={handleChange}
                    placeholder="Ex: O melhor da região"
                    maxLength={50}
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label>Sobre a Loja (Descrição Longa) *</label>
                  <textarea
                    name="descLonga"
                    className={styles.input}
                    rows={4}
                    value={formData.descLonga}
                    onChange={handleChange}
                    placeholder="Conte um pouco sobre sua história e produtos..."
                  ></textarea>
                </div>
                <div className={styles.inputGroup}>
                  <label>Foto da Loja *</label>
                  <input
                    type="file"
                    id="foto-upload"
                    className={styles.hiddenInput}
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, "fotoLoja", setFotoLojaPreview)}
                  />
                  <label htmlFor="foto-upload" className={styles.fileUploadLabel}>
                    {fotoLojaPreview ? (
                      <div style={{ textAlign: "center" }}>
                        <img
                          src={fotoLojaPreview}
                          alt="Foto Loja"
                          style={{ maxHeight: "150px", borderRadius: "8px", marginBottom: "10px" }}
                        />
                        <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Clique para trocar</div>
                      </div>
                    ) : (
                      <div className={styles.placeholderContent}>
                        <Camera size={32} />
                        <div>Clique para adicionar foto da loja</div>
                      </div>
                    )}
                  </label>
                </div>
              </>
            )}
            <div style={{ height: "40px" }}></div>
          </div>

          {/* FOOTER */}
          <div className={styles.actions}>
            {currentStep > 1 ? (
              <button
                className={styles.btnPrev}
                onClick={() => {
                   setSubmitError(null);
                   setCurrentStep((s) => s - 1);
                }}
                disabled={loadingSubmit}
              >
                <ArrowLeft size={18} /> Voltar
              </button>
            ) : (
              <div></div>
            )}

            <button
              className={styles.btnNext}
              disabled={loadingSubmit}
              onClick={() => currentStep === 4 ? handleSubmit() : handleNextStep()}
            >
              {loadingSubmit ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Processando...
                </>
              ) : currentStep === 4 ? (
                "Concluir e Pagar"
              ) : (
                <>
                  Próximo <ArrowRight size={18} />
                </>
              )}
            </button>
          </div>
        </main>
      </div>
    </div>
  );
};

export default RegisterStore;