import React, { useState, useEffect } from "react";
import styles from "./RegisterStore.module.css";
import {
  Check,
  Camera,
  Upload,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Image as ImageIcon,
} from "lucide-react";
import { PatternFormat } from "react-number-format";

const RegisterStore = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loadingCep, setLoadingCep] = useState(false);

  // --- ESTADOS PARA PREVIEW DE IMAGEM (Novos) ---
  // Separamos os dados reais (no formData) da visualização (aqui)
  const [logoPreview, setLogoPreview] = useState(null);
  const [fotoLojaPreview, setFotoLojaPreview] = useState(null);

  const [formData, setFormData] = useState({
    nomeLoja: "",
    cep: "",
    rua: "",
    numero: "",
    complemento: "",
    email: "",
    telefone: "",
    proprietario: "",
    documento: "",
    descCurta: "",
    descLonga: "",
    logo: null,
    fotoLoja: null,
  });

  // --- VALIDAÇÕES TÉCNICAS ---
  const validateEmail = (email) =>
    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(
      String(email).toLowerCase(),
    );
  const validatePhone = (phone) => phone.replace(/\D/g, "").length === 11;
  const validateDoc = (doc) => {
    const clean = doc.replace(/\D/g, "");
    return clean.length === 11 || clean.length === 14;
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 1:
        return formData.nomeLoja.trim().length >= 3 && formData.logo !== null;
      case 2:
        return (
          formData.cep.replace(/\D/g, "").length === 8 &&
          formData.rua.trim().length > 0 &&
          formData.numero.trim().length > 0
        );
      case 3:
        return (
          formData.proprietario.trim().length > 2 &&
          validateDoc(formData.documento) &&
          validateEmail(formData.email) &&
          validatePhone(formData.telefone)
        );
      case 4:
        return (
          formData.descCurta.trim().length > 5 &&
          formData.descLonga.trim().length > 10 &&
          formData.fotoLoja !== null
        );
      default:
        return false;
    }
  };

  // --- HANDLERS ---
  const handleCepChange = async (e) => {
    const cep = e.target.value.replace(/\D/g, "");
    setFormData((prev) => ({ ...prev, cep: e.target.value }));
    if (cep.length === 8) {
      setLoadingCep(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await res.json();
        if (!data.erro)
          setFormData((prev) => ({
            ...prev,
            rua: data.logradouro,
            complemento: data.complemento || prev.complemento,
          }));
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingCep(false);
      }
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // --- NOVO HANDLER DE ARQUIVOS COM PREVIEW ---
  // Agora aceita o nome do campo e a função para setar o preview correspondente
  const handleFileChange = (e, fieldName, setPreviewFn) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith("image/")) {
      // 1. Salva o arquivo real para envio ao backend
      setFormData((prev) => ({ ...prev, [fieldName]: file }));

      // 2. Gera a URL temporária para preview instantâneo
      const previewUrl = URL.createObjectURL(file);
      setPreviewFn(previewUrl);
    }
  };

  // Limpeza de memória (Boa prática de engenharia):
  // Revoga as URLs de preview quando o componente desmonta para evitar memory leaks
  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
      if (fotoLojaPreview) URL.revokeObjectURL(fotoLojaPreview);
    };
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {/* SIDEBAR FIXA */}
        <aside className={styles.sidebar}>
          <div className={styles.brand}>Anuncia Já</div>
          <h2 className={styles.sidebarTitle}>Criar conta</h2>
          <div className={styles.stepsContainer}>
            {[1, 2, 3, 4].map((num) => (
              <div
                key={num}
                className={`${styles.stepItem} ${currentStep >= num ? styles.stepActive : ""}`}
              >
                <div
                  className={`${styles.stepNumber} ${currentStep >= num ? styles.stepNumberActive : ""}`}
                >
                  {currentStep > num ? <Check size={14} /> : num}
                </div>
                <span>
                  {num === 1
                    ? "Loja"
                    : num === 2
                      ? "Local"
                      : num === 3
                        ? "Contato"
                        : "Vitrine"}
                </span>
              </div>
            ))}
          </div>
        </aside>

        {/* AREA DE CONTEUDO */}
        <main className={styles.content}>
          {/* HEADER FIXO */}
          <div className={styles.headerArea}>
            <h3 className={styles.stepTitle}>
              {currentStep === 1 && "Identidade da Loja"}
              {currentStep === 2 && "Onde te encontram?"}
              {currentStep === 3 && "Responsável e Contato"}
              {currentStep === 4 && "Sua Vitrine"}
            </h3>
          </div>

          {/* AREA DE SCROLL (MIOLO) */}
          <div className={styles.scrollWindow}>
            {currentStep === 1 && (
              <>
                <div className={styles.inputGroup}>
                  <label>Nome da Empresa</label>
                  <input
                    name="nomeLoja"
                    className={styles.input}
                    value={formData.nomeLoja}
                    onChange={handleChange}
                    placeholder="Ex: Mercado Central"
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label>Logo da Empresa</label>

                  {/* --- UPLOAD DE LOGO COM PREVIEW --- */}
                  <input
                    type="file"
                    id="logo-upload"
                    className={styles.hiddenInput}
                    accept="image/*"
                    onChange={(e) =>
                      handleFileChange(e, "logo", setLogoPreview)
                    }
                  />
                  <label
                    htmlFor="logo-upload"
                    className={styles.fileUploadLabel}
                  >
                    {logoPreview ? (
                      <>
                        <img
                          src={logoPreview}
                          alt="Preview Logo"
                          className={styles.previewImage}
                        />
                        <div className={styles.changeOverlay}>
                          <Upload size={20} />
                          <span>Trocar imagem</span>
                        </div>
                      </>
                    ) : (
                      <div className={styles.placeholderContent}>
                        <Upload size={20} />
                        <span>Clique para subir a logo</span>
                      </div>
                    )}
                  </label>
                  {/* ---------------------------------- */}
                </div>
              </>
            )}

            {currentStep === 2 && (
              <>
                <div className={styles.flexRow}>
                  <div className={`${styles.inputGroup} ${styles.colHalf}`}>
                    <label>
                      CEP{" "}
                      {loadingCep && (
                        <Loader2 size={12} className="animate-spin" />
                      )}
                    </label>
                    <PatternFormat
                      format="#####-###"
                      name="cep"
                      className={styles.input}
                      value={formData.cep}
                      onChange={handleCepChange}
                    />
                  </div>
                  <div className={`${styles.inputGroup} ${styles.colHalf}`}>
                    <label>Número</label>
                    <input
                      name="numero"
                      className={styles.input}
                      value={formData.numero}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                <div className={styles.inputGroup}>
                  <label>Rua</label>
                  <input
                    name="rua"
                    className={styles.input}
                    value={formData.rua}
                    onChange={handleChange}
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label>Complemento</label>
                  <input
                    name="complemento"
                    className={styles.input}
                    value={formData.complemento}
                    onChange={handleChange}
                    placeholder="Opcional"
                  />
                </div>
              </>
            )}

            {currentStep === 3 && (
              <>
                <div className={styles.inputGroup}>
                  <label>Nome do Proprietário</label>
                  <input
                    name="proprietario"
                    className={styles.input}
                    value={formData.proprietario}
                    onChange={handleChange}
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label>CPF ou CNPJ</label>
                  <input
                    name="documento"
                    className={styles.input}
                    value={formData.documento}
                    onChange={handleChange}
                    placeholder="Apenas números"
                  />
                </div>
                <div className={styles.flexRow}>
                  <div className={`${styles.inputGroup} ${styles.colHalf}`}>
                    <label>E-mail</label>
                    <input
                      name="email"
                      type="email"
                      className={styles.input}
                      value={formData.email}
                      onChange={handleChange}
                    />
                  </div>
                  <div className={`${styles.inputGroup} ${styles.colHalf}`}>
                    <label>Telefone</label>
                    <PatternFormat
                      format="(##) #####-####"
                      name="telefone"
                      className={styles.input}
                      value={formData.telefone}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </>
            )}

            {currentStep === 4 && (
              <>
                <div className={styles.inputGroup}>
                  <label>Slogan</label>
                  <input
                    name="descCurta"
                    className={styles.input}
                    value={formData.descCurta}
                    onChange={handleChange}
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label>Sobre a Loja</label>
                  <textarea
                    name="descLonga"
                    className={styles.input}
                    rows={4}
                    value={formData.descLonga}
                    onChange={handleChange}
                  ></textarea>
                </div>
                <div className={styles.inputGroup}>
                  <label>Foto da Loja</label>

                  {/* --- UPLOAD DE FOTO DA LOJA COM PREVIEW --- */}
                  <input
                    type="file"
                    id="foto-upload"
                    className={styles.hiddenInput}
                    accept="image/*"
                    onChange={(e) =>
                      handleFileChange(e, "fotoLoja", setFotoLojaPreview)
                    }
                  />
                  <label
                    htmlFor="foto-upload"
                    className={styles.fileUploadLabel}
                  >
                    {fotoLojaPreview ? (
                      <>
                        <img
                          src={fotoLojaPreview}
                          alt="Preview Foto Loja"
                          className={styles.previewImage}
                        />
                        <div className={styles.changeOverlay}>
                          <Camera size={20} />
                          <span>Trocar foto</span>
                        </div>
                      </>
                    ) : (
                      <div className={styles.placeholderContent}>
                        <Camera size={20} />
                        <span>Clique para subir a foto</span>
                      </div>
                    )}
                  </label>
                  {/* ---------------------------------------- */}
                </div>
              </>
            )}

            <div style={{ height: "20px" }}></div>
          </div>

          {/* FOOTER FIXO */}
          <div className={styles.actions}>
            {currentStep > 1 ? (
              <button
                className={styles.btnPrev}
                onClick={() => setCurrentStep((s) => s - 1)}
              >
                <ArrowLeft size={18} /> Voltar
              </button>
            ) : (
              <div></div>
            )}

            <button
              className={styles.btnNext}
              disabled={!isStepValid()}
              onClick={() =>
                currentStep === 4
                  ? console.log("Enviar para API:", formData)
                  : setCurrentStep((s) => s + 1)
              }
              style={{
                opacity: isStepValid() ? 1 : 0.5,
                cursor: isStepValid() ? "pointer" : "not-allowed",
              }}
            >
              {currentStep === 4 ? "Concluir" : "Próximo"}
              {currentStep < 4 && <ArrowRight size={18} />}
            </button>
          </div>
        </main>
      </div>
    </div>
  );
};

export default RegisterStore;
