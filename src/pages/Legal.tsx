import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { submitPrivacyRequest } from '../lib/requests';

const VERSION = '1.0 — 6 de setembro de 2026';

const documents = {
  termos: {
    title: 'Termos de Uso',
    sections: [
      ['Objeto', 'O Presença Jurídica é um software de apoio à organização comercial e operacional de escritórios. Ele não presta aconselhamento jurídico, não substitui sistemas processuais oficiais e não garante resultados profissionais.'],
      ['Conta e responsabilidades', 'O cliente deve manter contas individuais, permissões adequadas e informações atualizadas. É vedado compartilhar credenciais, usar o serviço para fins ilícitos ou inserir conteúdo sem base legal.'],
      ['Assinatura', 'O teste dura 15 dias. Planos pagos, limites e valores exibidos na contratação integram a oferta vigente. Inadimplência pode gerar tolerância temporária e posterior acesso somente para consulta e regularização.'],
      ['Disponibilidade', 'Empregamos medidas razoáveis de continuidade, segurança e cópia de dados. Manutenções, falhas de terceiros e eventos fora de controle podem causar indisponibilidade temporária.'],
      ['Cancelamento', 'O cliente pode cancelar a assinatura e solicitar exportação. A exclusão integral observa a janela de retenção informada no produto e obrigações legais aplicáveis.'],
    ],
  },
  privacidade: {
    title: 'Aviso de Privacidade',
    sections: [
      ['Papéis e finalidade', 'O escritório contratante é controlador dos dados de seus clientes e contatos; o Presença Jurídica atua como operador para hospedar e processar esses dados conforme instruções do escritório. Para conta, cobrança, segurança e suporte, tratamos os dados necessários como controlador.'],
      ['Dados tratados', 'Podemos tratar identificação, contato, dados profissionais, registros de atendimento, documentos enviados, eventos de segurança, uso do produto e informações de cobrança.'],
      ['Base, compartilhamento e retenção', 'O tratamento se apoia na execução contratual, cumprimento legal, exercício regular de direitos, legítimo interesse e consentimento quando aplicável. Dados podem ser compartilhados com provedores essenciais sob obrigações de segurança. A retenção segue a finalidade, o contrato e prazos legais.'],
      ['Segurança', 'Aplicamos segregação por escritório, controle de acesso, trilhas de auditoria, URLs temporárias para documentos e proteção de operações sensíveis no backend. Nenhum sistema elimina integralmente o risco.'],
      ['Direitos', 'Titulares podem pedir confirmação, acesso, correção, portabilidade, informação, revogação ou exclusão, observadas exceções legais. Use o formulário abaixo para receber um protocolo.'],
    ],
  },
  cookies: {
    title: 'Aviso de Cookies',
    sections: [
      ['Uso essencial', 'Usamos armazenamento e tecnologias estritamente necessárias para autenticação, segurança, preferências e funcionamento do aplicativo.'],
      ['Medição e terceiros', 'Recursos opcionais de proteção contra abuso podem usar tecnologia do Google reCAPTCHA/App Check. Cookies analíticos ou publicitários não devem ser ativados sem informação e base legal adequadas.'],
      ['Controle', 'Você pode controlar cookies pelo navegador. Bloquear itens essenciais pode impedir login, proteção contra fraude ou funcionamento de recursos.'],
    ],
  },
} as const;

export const Legal = () => {
  const { document = 'privacidade' } = useParams();
  const content = documents[document as keyof typeof documents] || documents.privacidade;
  const [email, setEmail] = useState('');
  const [requestType, setRequestType] = useState('access');
  const [details, setDetails] = useState('');
  const [protocol, setProtocol] = useState('');
  const [error, setError] = useState('');

  const handleRequest = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    try { setProtocol((await submitPrivacyRequest({ email, requestType, details })).protocol); setDetails(''); }
    catch (requestError) { console.error(requestError); setError('Não foi possível registrar a solicitação. Tente novamente.'); }
  };

  return <main className="min-h-screen bg-slate-50 px-5 py-10"><article className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-7 shadow-sm md:p-10"><Link to="/login" className="text-sm font-semibold text-brand-700">← Voltar ao acesso</Link><h1 className="mt-6 text-3xl font-bold text-slate-900">{content.title}</h1><p className="mt-2 text-xs text-slate-500">Versão {VERSION}</p><div className="mt-8 space-y-7">{content.sections.map(([title, body]) => <section key={title}><h2 className="text-lg font-bold text-slate-900">{title}</h2><p className="mt-2 leading-7 text-slate-600">{body}</p></section>)}</div>{document === 'privacidade' && <section className="mt-10 border-t border-slate-200 pt-8"><h2 className="text-xl font-bold text-slate-900">Exercer direitos de titular</h2><form className="mt-4 space-y-4" onSubmit={handleRequest}><Input required type="email" placeholder="Seu e-mail" value={email} onChange={event => setEmail(event.target.value)} /><select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" value={requestType} onChange={event => setRequestType(event.target.value)}><option value="access">Acesso</option><option value="correction">Correção</option><option value="deletion">Exclusão</option><option value="portability">Portabilidade</option><option value="information">Informações</option><option value="revocation">Revogação de consentimento</option></select><textarea required minLength={10} maxLength={3000} className="min-h-28 w-full rounded-md border border-slate-300 p-3 text-sm" placeholder="Descreva sua solicitação" value={details} onChange={event => setDetails(event.target.value)} /><Button>Registrar solicitação</Button>{protocol && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Solicitação registrada. Protocolo: <strong>{protocol}</strong></p>}{error && <p className="text-sm text-red-600">{error}</p>}</form></section>}<nav className="mt-10 flex flex-wrap gap-4 border-t border-slate-200 pt-5 text-sm"><Link className="text-brand-700" to="/legal/termos">Termos</Link><Link className="text-brand-700" to="/legal/privacidade">Privacidade</Link><Link className="text-brand-700" to="/legal/cookies">Cookies</Link></nav></article></main>;
};
