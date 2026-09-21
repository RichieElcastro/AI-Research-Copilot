import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type SupportedLanguage = 'id' | 'en';

export interface Translations {
  navbar: {
    brandTitle: string;
    phase: string;
    workspace: string;
    defaultSubtitle: string;
    dataIntegrity: string;
    securityAudit: string;
    projects: string;
    signInRegister: string;
    switchAccount: string;
    signOut: string;
    language: string;
    switchLanguage: string;
  };
  stages: {
    setup: string;
    setupDesc: string;
    variables: string;
    variablesDesc: string;
    instruments: string;
    instrumentsDesc: string;
    questionnaire: string;
    questionnaireDesc: string;
    collection: string;
    collectionDesc: string;
    processing: string;
    processingDesc: string;
    scoring: string;
    scoringDesc: string;
    analysis: string;
    analysisDesc: string;
    results: string;
    resultsDesc: string;
    export: string;
    exportDesc: string;
    audit: string;
    auditDesc: string;
  };
  projects: {
    title: string;
    subtitle: string;
    newProject: string;
    searchPlaceholder: string;
    filterAll: string;
    filterActive: string;
    filterDraft: string;
    filterArchived: string;
    noProjects: string;
    openWorkspace: string;
    editProject: string;
    deleteProject: string;
    archiveProject: string;
    unarchiveProject: string;
    confirmDeleteTitle: string;
    confirmDeleteMsg: string;
    variablesCount: string;
  };
  variables: {
    title: string;
    subtitle: string;
    addVariable: string;
    addDimension: string;
    addIndicator: string;
    conceptualDef: string;
    operationalDef: string;
    dimensionsCount: string;
    indicatorsCount: string;
    scale: string;
    role: string;
    type: string;
    searchPlaceholder: string;
    filterAllRoles: string;
    methodologyGuide: string;
    nextToInstruments: string;
    emptyTitle: string;
    emptyDesc: string;
    addFirst: string;
    independent: string;
    dependent: string;
    control: string;
    demographic: string;
    moderator: string;
    mediator: string;
  };
  instruments: {
    title: string;
    subtitle: string;
    createInstrument: string;
    approveInstrument: string;
    approved: string;
    draft: string;
    items: string;
    validatePsychometrics: string;
    reverseCoded: string;
    required: string;
  };
  questionnaire: {
    title: string;
    subtitle: string;
    publish: string;
    published: string;
    publicSurveyLink: string;
    copyLink: string;
    openSurvey: string;
    anonymityNotice: string;
  };
  common: {
    save: string;
    cancel: string;
    close: string;
    back: string;
    next: string;
    delete: string;
    edit: string;
    loading: string;
    success: string;
    error: string;
    confirm: string;
    actions: string;
    status: string;
    created: string;
    updated: string;
    academicFooter: string;
    allRightsReserved: string;
  };
}

export const TRANSLATIONS: Record<SupportedLanguage, Translations> = {
  id: {
    navbar: {
      brandTitle: 'Platform Penelitian Kuantitatif',
      phase: 'Fase 1 Utama',
      workspace: 'Ruang Kerja',
      defaultSubtitle: 'Studio Penelitian Empiris & Operasionalisasi',
      dataIntegrity: 'Integritas Data & Jejak Audit',
      securityAudit: 'Audit Keamanan',
      projects: 'Daftar Proyek',
      signInRegister: 'Masuk / Daftar',
      switchAccount: 'Ganti Akun Peneliti',
      signOut: 'Keluar',
      language: 'Bahasa',
      switchLanguage: 'Pilih Bahasa Tampilan',
    },
    stages: {
      setup: 'Persiapan Penelitian',
      setupDesc: 'Tujuan empiris, metodologi, populasi & rancangan penelitian',
      variables: 'Variabel Penelitian',
      variablesDesc: 'Konstruk, peran variabel, skala, dimensi & indikator empiris',
      instruments: 'Instrumen Pengukuran',
      instrumentsDesc: 'Butir skala, referensi literatur & aturan skoring terbalik',
      questionnaire: 'Kuesioner',
      questionnaireDesc: 'Gerbang audit, formulir informed consent & rilis versi',
      collection: 'Pengumpulan Data',
      collectionDesc: 'Pengiriman data responden anonim & penyimpanan respons mentah',
      processing: 'Pemrosesan Data',
      processingDesc: 'Pengkodean deterministik, reverse-coding & pembentukan dataset terproses',
      scoring: 'Skoring & Agregasi',
      scoringDesc: 'Perhitungan agregat skor dimensi & konstruk komposit secara deterministik',
      analysis: 'Analisis Statistik',
      analysisDesc: 'Statistik deskriptif, Cronbach alpha, korelasi Pearson, regresi OLS & uji-t',
      results: 'Hasil & Pelaporan',
      resultsDesc: 'Tabel standar APA, pembuktian hipotesis & laporan terverifikasi',
      export: 'Ekspor Data',
      exportDesc: 'Dataset siap SPSS/R, metadata buku kode & manifes audit',
      audit: 'Jejak Audit',
      auditDesc: 'Pencatatan riwayat perubahan data dan tindakan peneliti secara permanen',
    },
    projects: {
      title: 'Proyek Penelitian',
      subtitle: 'Ruang kerja penelitian empiris, operasionalisasi konstruk, dan instrumen psikometrik',
      newProject: 'Buat Proyek Baru',
      searchPlaceholder: 'Cari proyek berdasarkan judul, kode, atau deskripsi...',
      filterAll: 'Semua Status',
      filterActive: 'Aktif',
      filterDraft: 'Draf',
      filterArchived: 'Diarsipkan',
      noProjects: 'Belum ada proyek penelitian ditemukan',
      openWorkspace: 'Buka Ruang Kerja',
      editProject: 'Ubah Proyek',
      deleteProject: 'Hapus Proyek',
      archiveProject: 'Arsipkan Proyek',
      unarchiveProject: 'Batal Arsipkan',
      confirmDeleteTitle: 'Hapus Proyek Penelitian?',
      confirmDeleteMsg: 'Tindakan ini akan menghapus seluruh variabel, instrumen, dan data survei terkait secara permanen.',
      variablesCount: 'Variabel',
    },
    variables: {
      title: 'Variabel Penelitian',
      subtitle: 'Operasionalisasi konstruk, skala pengukuran, dimensi & indikator empiris',
      addVariable: 'Tambah Variabel',
      addDimension: 'Tambah Dimensi',
      addIndicator: 'Tambah Indikator',
      conceptualDef: 'Definisi Konseptual',
      operationalDef: 'Definisi Operasional',
      dimensionsCount: 'Dimensi',
      indicatorsCount: 'Indikator',
      scale: 'Skala Pengukuran',
      role: 'Peran Variabel',
      type: 'Tipe Variabel',
      searchPlaceholder: 'Cari nama variabel, kode, atau indikator...',
      filterAllRoles: 'Semua Peran',
      methodologyGuide: 'Panduan Metodologi',
      nextToInstruments: 'Lanjut ke Instrumen',
      emptyTitle: 'Belum Ada Variabel Penelitian',
      emptyDesc: 'Mulai dengan menambahkan variabel independen, dependen, atau kontrol untuk proyek ini.',
      addFirst: '+ Tambah Variabel Pertama',
      independent: 'Variabel Independen (X)',
      dependent: 'Variabel Dependen (Y)',
      control: 'Variabel Kontrol',
      demographic: 'Variabel Demografis',
      moderator: 'Variabel Moderasi',
      mediator: 'Variabel Mediasi',
    },
    instruments: {
      title: 'Instrumen Pengukuran',
      subtitle: 'Skala psikometrik, pemetaan indikator, dan aturan skoring item',
      createInstrument: 'Buat Instrumen Baru',
      approveInstrument: 'Setujui Instrumen',
      approved: 'Disetujui',
      draft: 'Draf',
      items: 'Butir Pertanyaan',
      validatePsychometrics: 'Audit Psikometrik',
      reverseCoded: 'Skor Terbalik (Reverse)',
      required: 'Wajib Diisi',
    },
    questionnaire: {
      title: 'Desain & Publikasi Kuesioner',
      subtitle: 'Kuesioner partisipan dengan penjaminan privasi dan integritas data',
      publish: 'Publikasikan Kuesioner',
      published: 'Dipublikasikan',
      publicSurveyLink: 'Tautan Survei Publik',
      copyLink: 'Salin Tautan',
      openSurvey: 'Buka Survei Publik',
      anonymityNotice: 'Pengumpulan Data Anonim Ketat (Strict Anonymity Mode)',
    },
    common: {
      save: 'Simpan',
      cancel: 'Batal',
      close: 'Tutup',
      back: 'Kembali',
      next: 'Lanjutkan',
      delete: 'Hapus',
      edit: 'Ubah',
      loading: 'Memuat data...',
      success: 'Berhasil',
      error: 'Terjadi Kesalahan',
      confirm: 'Konfirmasi',
      actions: 'Aksi',
      status: 'Status',
      created: 'Dibuat',
      updated: 'Diperbarui',
      academicFooter: 'Logika Bisnis Deterministik • Isolasi Data Antar-Peneliti Ketat',
      allRightsReserved: 'Hak Cipta Dilindungi',
    },
  },
  en: {
    navbar: {
      brandTitle: 'Quantitative Research Platform',
      phase: 'Phase 1 Core',
      workspace: 'Workspace',
      defaultSubtitle: 'Empirical Research & Operationalization Studio',
      dataIntegrity: 'Data Integrity & Audit Lineage',
      securityAudit: 'Security Audit',
      projects: 'Projects',
      signInRegister: 'Sign In / Register',
      switchAccount: 'Switch Researcher Account',
      signOut: 'Sign Out',
      language: 'Language',
      switchLanguage: 'Select Display Language',
    },
    stages: {
      setup: 'Research Setup',
      setupDesc: 'Empirical objectives, methodology, population & design',
      variables: 'Variables',
      variablesDesc: 'Constructs, roles, scales, dimensions & indicators',
      instruments: 'Instruments',
      instrumentsDesc: 'Scale items, literature references & reverse scoring rules',
      questionnaire: 'Questionnaire',
      questionnaireDesc: 'Audit gates, consent form & versioned release candidate',
      collection: 'Data Collection',
      collectionDesc: 'Anonymous participant submission & raw response storage',
      processing: 'Data Processing',
      processingDesc: 'Deterministic coding, reverse coding & processed dataset generation',
      scoring: 'Scoring',
      scoringDesc: 'Deterministic dimension & composite construct aggregation',
      analysis: 'Statistical Analysis',
      analysisDesc: 'Descriptives, Cronbach alpha, Pearson r, OLS Regression & t-test',
      results: 'Results',
      resultsDesc: 'APA formatted tables, hypothesis decisions & verified reporting',
      export: 'Export',
      exportDesc: 'SPSS/R ready dataset, codebook metadata & audit manifest',
      audit: 'Audit Trail',
      auditDesc: 'Immutable record of state changes, validations, and provenance logs',
    },
    projects: {
      title: 'Research Projects',
      subtitle: 'Empirical research workspaces, construct operationalization, and psychometric instruments',
      newProject: 'New Research Project',
      searchPlaceholder: 'Search projects by title, code, or description...',
      filterAll: 'All Status',
      filterActive: 'Active',
      filterDraft: 'Draft',
      filterArchived: 'Archived',
      noProjects: 'No research projects found',
      openWorkspace: 'Open Workspace',
      editProject: 'Edit Project',
      deleteProject: 'Delete Project',
      archiveProject: 'Archive Project',
      unarchiveProject: 'Unarchive Project',
      confirmDeleteTitle: 'Delete Research Project?',
      confirmDeleteMsg: 'This will permanently remove all associated variables, instruments, and survey data.',
      variablesCount: 'Variables',
    },
    variables: {
      title: 'Research Variables',
      subtitle: 'Construct operationalization, measurement scales, dimensions & empirical indicators',
      addVariable: 'Add Variable',
      addDimension: 'Add Dimension',
      addIndicator: 'Add Indicator',
      conceptualDef: 'Conceptual Definition',
      operationalDef: 'Operational Definition',
      dimensionsCount: 'Dimensions',
      indicatorsCount: 'Indicators',
      scale: 'Measurement Scale',
      role: 'Variable Role',
      type: 'Variable Type',
      searchPlaceholder: 'Search variable names, codes, or indicators...',
      filterAllRoles: 'All Roles',
      methodologyGuide: 'Methodology Guide',
      nextToInstruments: 'Proceed to Instruments',
      emptyTitle: 'No Research Variables Yet',
      emptyDesc: 'Begin by adding independent, dependent, or control variables to this project.',
      addFirst: '+ Add First Variable',
      independent: 'Independent Variable (X)',
      dependent: 'Dependent Variable (Y)',
      control: 'Control Variable',
      demographic: 'Demographic Variable',
      moderator: 'Moderator Variable',
      mediator: 'Mediator Variable',
    },
    instruments: {
      title: 'Measurement Instruments',
      subtitle: 'Psychometric scales, indicator mappings, and item scoring rules',
      createInstrument: 'Create Instrument',
      approveInstrument: 'Approve Instrument',
      approved: 'Approved',
      draft: 'Draft',
      items: 'Scale Items',
      validatePsychometrics: 'Psychometric Audit',
      reverseCoded: 'Reverse Coded',
      required: 'Required',
    },
    questionnaire: {
      title: 'Questionnaire Design & Publishing',
      subtitle: 'Participant survey with strict data privacy and verified lineage',
      publish: 'Publish Questionnaire',
      published: 'Published',
      publicSurveyLink: 'Public Survey Link',
      copyLink: 'Copy Link',
      openSurvey: 'Open Public Survey',
      anonymityNotice: 'Strict Anonymous Response Collection',
    },
    common: {
      save: 'Save',
      cancel: 'Cancel',
      close: 'Close',
      back: 'Back',
      next: 'Next',
      delete: 'Delete',
      edit: 'Edit',
      loading: 'Loading...',
      success: 'Success',
      error: 'An Error Occurred',
      confirm: 'Confirm',
      actions: 'Actions',
      status: 'Status',
      created: 'Created',
      updated: 'Updated',
      academicFooter: 'Deterministic Business Logic • Strict Cross-Researcher Data Isolation',
      allRightsReserved: 'All rights reserved',
    },
  },
};

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  toggleLanguage: () => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LANGUAGE_STORAGE_KEY = 'preferred_language';

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    try {
      const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (saved === 'id' || saved === 'en') {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'id'; // Default to Bahasa Indonesia as requested
  });

  const setLanguage = (lang: SupportedLanguage) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch {
      // ignore
    }
  };

  const toggleLanguage = () => {
    setLanguage(language === 'id' ? 'en' : 'id');
  };

  useEffect(() => {
    // Sync document html lang attribute
    document.documentElement.lang = language;
  }, [language]);

  const value: LanguageContextType = {
    language,
    setLanguage,
    toggleLanguage,
    t: TRANSLATIONS[language],
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
