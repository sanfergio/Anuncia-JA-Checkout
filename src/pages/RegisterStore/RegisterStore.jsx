import React, { useState, useEffect, useRef } from "react";
import styles from "./RegisterStore.module.css";
import {
  Check,
  Camera,
  Upload,
  ArrowRight,
  ArrowLeft,
  Loader2,
  MapPin,
  Store,
  User,
  ShoppingBag,
  AlertCircle,
  X // Ícone novo para remover fotos
} from "lucide-react";
import { PatternFormat } from "react-number-format";

// --- CONFIGURAÇÕES ORIGINAIS DO SÓCIO ---
const API_ENDPOINT = "https://www.newandrews.com.br/checkout-asaas/index.php";
const IMGBB_API_KEY = "570dba9241a1e1c9300130c89fa05036";
const IMGBB_UPLOAD_URL = "https://api.imgbb.com/1/upload";

// --- UTILS ---
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).toLowerCase());

const isValidCpfCnpj = (val) => {
  if (!val) return false;
  const clean = val.replace(/\D/g, "");
  return clean.length === 11 || clean.length === 14; 
};

// --- COMPONENTE PRINCIPAL ---
const RegisterStore = () => {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const contentRef = useRef(null);

  // Estados dos Arquivos e Previews
  // ALTERAÇÃO: fotoLoja agora é um array [] para aceitar várias
  const [files, setFiles] = useState({ logo: null, fotoLoja: [] });
  const [previews, setPreviews] = useState({ logo: null, fotoLoja: [] });

  // Estado do Formulário
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
    documento: "",
    descCurta: "",
    descLonga: "",
  });

  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
    window.scrollTo(0, 0);
  }, [step]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  // Handler de Arquivos (MODIFICADO PARA MÚLTIPLOS)
  const handleFile = (e, key) => {
    if (key === 'logo') {
      // Logo continua sendo 1 arquivo só
      const file = e.target.files[0];
      if (file) {
        if (file.size > 5 * 1024 * 1024) { setErrorMsg("A imagem deve ter no máximo 5MB."); return; }
        setFiles((prev) => ({ ...prev, logo: file }));
        setPreviews((prev) => ({ ...prev, logo: URL.createObjectURL(file) }));
        setFieldErrors((prev) => ({ ...prev, logo: null }));
        setErrorMsg(null);
      }
    } else if (key === 'fotoLoja') {
      // Vitrine agora aceita múltiplos arquivos
      const newFiles = Array.from(e.target.files); // Converte FileList para Array
      
      // Validação de tamanho para cada arquivo
      const validFiles = newFiles.filter(f => f.size <= 5 * 1024 * 1024);
      if (validFiles.length !== newFiles.length) {
         setErrorMsg("Algumas imagens eram maiores que 5MB e foram ignoradas.");
      }

      // Adiciona aos existentes
      setFiles(prev => ({ ...prev, fotoLoja: [...prev.fotoLoja, ...validFiles] }));
      
      // Gera previews novos
      const newPreviews = validFiles.map(f => URL.createObjectURL(f));
      setPreviews(prev => ({ ...prev, fotoLoja: [...prev.fotoLoja, ...newPreviews] }));
      
      setFieldErrors(prev => ({ ...prev, fotoLoja: null }));
    }
  };

  // Função para remover uma foto da galeria
  const removePhoto = (index) => {
    setFiles(prev => ({
      ...prev,
      fotoLoja: prev.fotoLoja.filter((_, i) => i !== index)
    }));
    setPreviews(prev => ({
      ...prev,
      fotoLoja: prev.fotoLoja.filter((_, i) => i !== index)
    }));
  };

  const handleCep = async (e) => {
    const valor = e.target.value;
    setFormData(prev => ({ ...prev, cep: valor }));

    const cepLimpo = valor.replace(/\D/g, "");
    if (cepLimpo.length === 8) {
      setIsLoading(true);
      try {
        const req = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
        const data = await req.json();
        if (!data.erro) {
          setFormData(prev => ({
            ...prev,
            rua: data.logradouro,
            bairro: data.bairro,
            complemento: data.complemento || prev.complemento
          }));
          setFieldErrors(prev => ({ ...prev, rua: null, bairro: null }));
        }
      } catch (err) { console.error(err); } finally { setIsLoading(false); }
    }
  };

  // Upload para ImgBB
  const uploadImage = async (file) => {
    const data = new FormData();
    data.append("image", file);
    data.append("key", IMGBB_API_KEY);

    const res = await fetch(IMGBB_UPLOAD_URL, { method: "POST", body: data });
    const json = await res.json();
    if (!json.success) throw new Error("Falha no upload da imagem");
    return json.data.url;
  };

  const validateStep = () => {
    const errors = {};
    let isValid = true;

    if (step === 1) {
      if (formData.nomeLoja.length < 3) errors.nomeLoja = true;
      if (!files.logo) errors.logo = true;
    }
    if (step === 2) {
      if (formData.cep.replace(/\D/g, "").length !== 8) errors.cep = true;
      if (!formData.rua) errors.rua = true;
      if (!formData.numero) errors.numero = true;
    }
    if (step === 3) {
      if (formData.proprietario.length < 3) errors.proprietario = true;
      if (!isValidEmail(formData.email)) errors.email = true;
      if (formData.telefone.replace(/\D/g, "").length < 10) errors.telefone = true;
      if (!isValidCpfCnpj(formData.documento)) errors.documento = true;
    }
    if (step === 4) {
      if (formData.descCurta.length < 5) errors.descCurta = true;
      if (formData.descLonga.length < 10) errors.descLonga = true;
      // Verifica se tem pelo menos 1 foto no array
      if (files.fotoLoja.length === 0) errors.fotoLoja = true;
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setErrorMsg("Preencha os campos obrigatórios marcados em vermelho.");
      isValid = false;
    } else { setErrorMsg(null); }

    return isValid;
  };

  const handleNext = () => {
    if (validateStep()) setStep((prev) => prev + 1);
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;

    setIsLoading(true);
    setErrorMsg(null);

    try {
      // 1. Upload Logo (Único)
      const logoUrl = await uploadImage(files.logo);

      // 2. Upload Vitrine (Múltiplos - ImgBB)
      // Faz o upload de todas as fotos em paralelo
      const uploadPromises = files.fotoLoja.map(file => uploadImage(file));
      const uploadedUrls = await Promise.all(uploadPromises);
      
      // Junta as URLs numa string só (separada por vírgula) para o PHP entender
      const fotoLojaUrlString = uploadedUrls.join(', ');

      // 3. Enviar para Backend PHP
      const payload = {
        ...formData,
        cep: formData.cep.replace(/\D/g, ""),
        telefone: formData.telefone.replace(/\D/g, ""),
        documento: formData.documento.replace(/\D/g, ""),
        logoUrl: logoUrl,
        fotoLojaUrl: fotoLojaUrlString, // Enviando string combinada
        descricaoCurta: formData.descCurta,
        descricaoLonga: formData.descLonga
      };

      const response = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (result.success && result.paymentUrl) {
        window.location.href = result.paymentUrl;
      } else {
        throw new Error(result.message || "Erro desconhecido no servidor");
      }

    } catch (err) {
      setErrorMsg(err.message || "Erro ao conectar com o servidor.");
      setIsLoading(false);
    }
  };

  const Steps = [
    { id: 1, icon: Store, title: "Identidade", sub: "Nome e Logo" },
    { id: 2, icon: MapPin, title: "Localização", sub: "Endereço completo" },
    { id: 3, icon: User, title: "Responsável", sub: "Dados de contato" },
    { id: 4, icon: ShoppingBag, title: "Vitrine", sub: "Galeria de Fotos" },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.headerMobile}>
        <div className={styles.brand}><Store size={24} /> <span>Anuncia Já</span></div>
        <div className={styles.mobileStepText}>Passo {step} de 4</div>
      </div>

      <div className={styles.mobileProgress}>
        <div className={styles.mobileProgressBar} style={{ width: `${(step / 4) * 100}%` }} />
      </div>

      <div className={styles.card}>
        <aside className={styles.sidebar}>
          <div>
            <div className={styles.brand}><Store size={28} /><span>Anuncia Já</span></div>
            <div className={styles.stepsContainer}>
              {Steps.map((s) => (
                <div key={s.id} className={`${styles.stepItem} ${step >= s.id ? styles.stepActive : ''}`}>
                  <div className={styles.stepIcon}>{step > s.id ? <Check size={18} /> : <s.icon size={18} />}</div>
                  <div className={styles.stepInfo}><span className={styles.stepTitle}>{s.title}</span><span className={styles.stepSubtitle}>{s.sub}</span></div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ opacity: 0.8, fontSize: '0.8rem' }}>© 2026 Anuncia Já<br />Pagamento Seguro via Asaas</div>
        </aside>

        <main className={styles.content} ref={contentRef}>
          <div className={styles.formHeader}>
            <h2 className={styles.formTitle}>
              {step === 1 && "Vamos começar pela sua marca"}
              {step === 2 && "Onde seus clientes te encontram?"}
              {step === 3 && "Quem é o responsável?"}
              {step === 4 && "Monte sua vitrine"}
            </h2>
            <p className={styles.formSubtitle}>Preencha os dados abaixo para configurar sua loja.</p>
          </div>

          {errorMsg && <div className={styles.globalError}><AlertCircle size={20} />{errorMsg}</div>}

          <div className={styles.formGrid}>
            {step === 1 && (
              <>
                <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                  <label className={styles.label}>Nome da Loja</label>
                  <input name="nomeLoja" className={`${styles.input} ${fieldErrors.nomeLoja ? styles.inputError : ''}`} placeholder="Ex: Mercado Central" value={formData.nomeLoja} onChange={handleChange} />
                </div>
                <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                  <label className={styles.label}>Logo da Marca</label>
                  <div className={styles.uploadContainer} style={{ borderColor: fieldErrors.logo ? 'var(--error)' : '' }}>
                    <input type="file" id="file-logo" hidden accept="image/*" onChange={(e) => handleFile(e, 'logo')} />
                    <label htmlFor="file-logo" style={{ width: '100%', height: '100%', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      {previews.logo ? (
                        <>
                          <img src={previews.logo} className={styles.uploadPreview} alt="Logo" />
                          <div className={styles.previewOverlay}><Camera size={24} /> <span style={{ marginLeft: 8 }}>Trocar</span></div>
                        </>
                      ) : (
                        <><Upload size={32} color="var(--primary)" /><span style={{ marginTop: 12, color: 'var(--text-muted)' }}>Clique para adicionar logo</span></>
                      )}
                    </label>
                  </div>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className={styles.formGroup}>
                  <label className={styles.label}>CEP</label>
                  <PatternFormat format="#####-###" name="cep" className={`${styles.input} ${fieldErrors.cep ? styles.inputError : ''}`} placeholder="00000-000" value={formData.cep} onChange={handleCep} />
                  {isLoading && <small style={{ color: 'var(--primary)' }}>Buscando endereço...</small>}
                </div>
                <div className={styles.formGroup}><label className={styles.label}>Número</label><input name="numero" className={`${styles.input} ${fieldErrors.numero ? styles.inputError : ''}`} placeholder="123" value={formData.numero} onChange={handleChange} /></div>
                <div className={`${styles.formGroup} ${styles.fullWidth}`}><label className={styles.label}>Rua</label><input name="rua" className={`${styles.input} ${fieldErrors.rua ? styles.inputError : ''}`} placeholder="Endereço" value={formData.rua} readOnly /></div>
                <div className={styles.formGroup}><label className={styles.label}>Bairro</label><input name="bairro" className={styles.input} value={formData.bairro} readOnly /></div>
                <div className={styles.formGroup}><label className={styles.label}>Complemento</label><input name="complemento" className={styles.input} placeholder="Apto, Sala..." value={formData.complemento} onChange={handleChange} /></div>
              </>
            )}

            {step === 3 && (
              <>
                <div className={`${styles.formGroup} ${styles.fullWidth}`}><label className={styles.label}>Nome Completo</label><input name="proprietario" className={`${styles.input} ${fieldErrors.proprietario ? styles.inputError : ''}`} placeholder="Seu nome" value={formData.proprietario} onChange={handleChange} /></div>
                <div className={styles.formGroup}><label className={styles.label}>CPF ou CNPJ</label><PatternFormat format={formData.documento.replace(/\D/g, "").length > 11 ? "##.###.###/####-##" : "###.###.###-###"} name="documento" className={`${styles.input} ${fieldErrors.documento ? styles.inputError : ''}`} placeholder="Documento" value={formData.documento} onValueChange={(vals) => setFormData(p => ({ ...p, documento: vals.value }))} /></div>
                <div className={styles.formGroup}><label className={styles.label}>Telefone / WhatsApp</label><PatternFormat format="(##) #####-####" name="telefone" className={`${styles.input} ${fieldErrors.telefone ? styles.inputError : ''}`} placeholder="(00) 90000-0000" value={formData.telefone} onChange={handleChange} /></div>
                <div className={`${styles.formGroup} ${styles.fullWidth}`}><label className={styles.label}>E-mail</label><input type="email" name="email" className={`${styles.input} ${fieldErrors.email ? styles.inputError : ''}`} placeholder="seu@email.com" value={formData.email} onChange={handleChange} /></div>
              </>
            )}

            {step === 4 && (
              <>
                <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                  <label className={styles.label}>Fotos da Vitrine / Loja</label>
                  {/* ALTERADO: Container agora aceita múltiplas fotos e tem estilo de galeria */}
                  <div className={styles.uploadContainer} style={{ borderColor: fieldErrors.fotoLoja ? 'var(--error)' : '', height: 'auto', minHeight: '180px', padding: '20px' }}>
                    <input type="file" id="file-loja" hidden accept="image/*" multiple onChange={(e) => handleFile(e, 'fotoLoja')} />
                    
                    {previews.fotoLoja.length > 0 ? (
                      <div className={styles.galleryGrid}>
                        {previews.fotoLoja.map((url, idx) => (
                          <div key={idx} className={styles.galleryItem}>
                            <img src={url} alt={`Preview ${idx}`} />
                            <button className={styles.removeBtn} onClick={(e) => { e.preventDefault(); removePhoto(idx); }}>
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                        <label htmlFor="file-loja" className={styles.addMoreBtn}>+ Adicionar</label>
                      </div>
                    ) : (
                      <label htmlFor="file-loja" style={{ width: '100%', height: '100%', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                         <Camera size={32} color="var(--primary)" />
                         <span style={{ marginTop: 12, color: 'var(--text-muted)' }}>Clique para selecionar fotos</span>
                         <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>(Pode selecionar várias)</span>
                      </label>
                    )}
                  </div>
                </div>

                <div className={`${styles.formGroup} ${styles.fullWidth}`}><label className={styles.label}>Slogan (Curto)</label><input name="descCurta" className={`${styles.input} ${fieldErrors.descCurta ? styles.inputError : ''}`} placeholder="Ex: O melhor preço da cidade" value={formData.descCurta} onChange={handleChange} maxLength={50} /></div>
                <div className={`${styles.formGroup} ${styles.fullWidth}`}><label className={styles.label}>Descrição Detalhada</label><textarea name="descLonga" className={`${styles.textarea} ${fieldErrors.descLonga ? styles.inputError : ''}`} placeholder="Conte sobre sua loja, horários de atendimento..." value={formData.descLonga} onChange={handleChange} /></div>
              </>
            )}
          </div>

          <div className={styles.actions}>
            {step > 1 ? <button className={styles.btnBack} onClick={() => setStep(s => s - 1)} disabled={isLoading}><ArrowLeft size={18} /> Voltar</button> : <div />}
            <button className={styles.btnNext} onClick={step === 4 ? handleSubmit : handleNext} disabled={isLoading}>
              {isLoading ? <><Loader2 className={styles.spinner} size={18} /> Processando...</> : step === 4 ? <>Concluir Cadastro <Check size={18} /></> : <>Próximo <ArrowRight size={18} /></>}
            </button>
          </div>
        </main>
      </div>
    </div>
  );
};

export default RegisterStore;