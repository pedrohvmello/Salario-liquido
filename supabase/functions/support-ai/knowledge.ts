// Single, public-product source for FAQ and Pep Ajuda. No user data or secrets.
// Any functional change should update this content AND review the public legal pages.
export type PayrepSupportQuestion={category:string;question:string;answer:string}
export const PAYREP_SUPPORT_FAQ:readonly PayrepSupportQuestion[]=[
  {
    "category": "Conta e acesso",
    "question": "Como criar uma conta no Payrep?",
    "answer": "Na tela de entrada, escolha cadastrar-se, informe os dados solicitados e confirme seu e-mail quando solicitado. O acesso pode depender da aprovação de um administrador, conforme a política de cadastro."
  },
  {
    "category": "Conta e acesso",
    "question": "Meu cadastro foi criado, mas não consigo entrar. O que verificar?",
    "answer": "Confira a confirmação de e-mail, a senha e a situação de aprovação da conta. Uma conta pendente, rejeitada ou suspensa pode ter acesso restrito. Se persistir, abra um chamado ou contate o suporte."
  },
  {
    "category": "Conta e acesso",
    "question": "Posso entrar com minha conta Google?",
    "answer": "Quando a opção estiver habilitada, selecione Entrar com Google na tela de login. Essa autenticação não autoriza leitura de seu Gmail ou Drive pelo Payrep."
  },
  {
    "category": "Conta e acesso",
    "question": "Como atualizar meus dados pessoais?",
    "answer": "Clique no avatar e abra Meu cadastro. Atualize os campos disponibilizados, como nome, telefone e endereço. CPF e data de nascimento, quando aplicáveis, são protegidos e utilizados para identificação e cobrança."
  },
  {
    "category": "Conta e acesso",
    "question": "Como alterar ou recuperar minha senha?",
    "answer": "Entre no avatar > Segurança para solicitar a alteração ou recuperação. Se não conseguir entrar, utilize o fluxo de redefinição de senha na tela de autenticação. Nunca compartilhe códigos de recuperação."
  },
  {
    "category": "Conta e acesso",
    "question": "O que são TOTP, biometria e passkey?",
    "answer": "TOTP é um código temporário de aplicativo autenticador; passkey usa a autenticação segura do dispositivo, que pode incluir biometria. Os métodos disponíveis dependem da configuração do ambiente e do navegador; administradores possuem requisitos adicionais."
  },
  {
    "category": "Conta e acesso",
    "question": "Como ativar a autenticação em duas etapas?",
    "answer": "Abra avatar > Segurança e siga as instruções da opção de autenticador disponível. Guarde com segurança o método de recuperação e confirme o fator antes de depender dele para acessar a conta."
  },
  {
    "category": "Conta e acesso",
    "question": "Esqueci o autenticador ou perdi acesso ao celular. O que fazer?",
    "answer": "Use os métodos de recuperação disponibilizados na tela de Segurança ou solicite atendimento pelo suporte. Por segurança, a equipe pode exigir verificação adicional de identidade."
  },
  {
    "category": "Visão geral e projeções",
    "question": "O que mostra a Visão geral?",
    "answer": "A tela reúne estimativas da remuneração líquida, componentes salariais e indicadores configurados. O resultado é uma projeção, não a confirmação de um pagamento do empregador."
  },
  {
    "category": "Visão geral e projeções",
    "question": "Como selecionar o mês e o ano da projeção?",
    "answer": "Na Visão geral, utilize o seletor de mês e ano associado à projeção. A competência altera os eventos vigentes considerados no cálculo."
  },
  {
    "category": "Visão geral e projeções",
    "question": "Como escolher e ordenar os indicadores da Visão geral?",
    "answer": "Abra Definições > Configurações da Visão Geral. Selecione e reordene os cartões disponíveis. No celular, a apresentação se adapta à largura da tela."
  },
  {
    "category": "Visão geral e projeções",
    "question": "Como configurar vale-refeição e benefícios?",
    "answer": "Cadastre o benefício e sua data de vigência em Eventos e vigências ou em Definições, conforme o campo. O vale-refeição por dia útil depende do calendário e da base informados, e não é um comprovante de crédito."
  },
  {
    "category": "Visão geral e projeções",
    "question": "Por que o salário líquido projetado difere do holerite?",
    "answer": "Confira a competência, a data de vigência dos eventos, INSS, IRRF, pensão, férias, faltas e demais rubricas. O empregador pode aplicar regras próprias que não constam dos dados cadastrados."
  },
  {
    "category": "Visão geral e projeções",
    "question": "Adiantamento e líquido final são a mesma coisa?",
    "answer": "Não. O Payrep distingue o valor pago antecipadamente do líquido final; o total líquido recebido considera ambos quando os registros estão disponíveis, evitando tratar o adiantamento como renda adicional."
  },
  {
    "category": "Eventos, vigências e remuneração",
    "question": "Onde registro uma alteração de salário ou triênio?",
    "answer": "Abra Eventos e vigências, escolha o tipo do evento, informe valor e data de vigência e salve. O cálculo usa os eventos válidos para a competência consultada."
  },
  {
    "category": "Eventos, vigências e remuneração",
    "question": "Quais eventos posso cadastrar?",
    "answer": "Entre os eventos disponíveis estão salário, triênio, benefícios, previdência por percentual, ESPP, dependentes, pensão, férias, 13º e PPR. Os tipos e campos podem depender da configuração."
  },
  {
    "category": "Eventos, vigências e remuneração",
    "question": "Como funciona a pensão alimentícia?",
    "answer": "Os parâmetros manuais são definidos conforme sua situação. A importação pode sugerir percentual apenas diante de evidências repetidas e consistentes; ela não interpreta decisões judiciais nem confirma incidências excepcionais."
  },
  {
    "category": "Eventos, vigências e remuneração",
    "question": "Por que a previdência não aparece como evento em valor fixo?",
    "answer": "A previdência privada é projetada pelo percentual configurado e pela base aplicável. O valor real pode variar com as rubricas de cada folha."
  },
  {
    "category": "Eventos, vigências e remuneração",
    "question": "Posso corrigir um evento gerado por holerite?",
    "answer": "Eventos importados preservam o vínculo com o documento. É possível ajustar a projeção conforme as ações disponíveis, mantendo a origem e o tipo do evento. Remover o holerite pode remover eventos vinculados."
  },
  {
    "category": "Eventos, vigências e remuneração",
    "question": "Como consultar alterações salariais antigas?",
    "answer": "Use Histórico salarial e os filtros de ano ou Todos os anos. Eventos e vigências preservam as alterações com as datas efetivas para consulta e cálculo."
  },
  {
    "category": "Controle de horas e banco de horas",
    "question": "Como registrar entrada, almoço e saída?",
    "answer": "Acesse Controle de horas, selecione a quinzena e informe os horários trabalhados e intervalos. Use Salvar quinzena para registrar as mudanças."
  },
  {
    "category": "Controle de horas e banco de horas",
    "question": "Como alternar entre primeira e segunda quinzena?",
    "answer": "Clique sobre o período exibido no Controle de horas, escolha ano, mês e primeira ou segunda quinzena e confirme."
  },
  {
    "category": "Controle de horas e banco de horas",
    "question": "Como limpar os horários de uma quinzena?",
    "answer": "No Controle de horas, utilize a opção de resetar horários da quinzena exibida. Confira o período antes de confirmar, pois a alteração afeta os registros selecionados."
  },
  {
    "category": "Controle de horas e banco de horas",
    "question": "Como são calculadas horas extras e banco de horas?",
    "answer": "Os cálculos usam horários registrados, base de trabalho, feriados e fatores do perfil de banco de horas quando configurado. Regras de domingo, feriado e compensação dependem do perfil aplicável, não de um multiplicador universal."
  },
  {
    "category": "Controle de horas e banco de horas",
    "question": "O Payrep reconhece feriados municipais?",
    "answer": "A base/cidade configurada orienta o calendário de feriados. Revise o local e os registros da jornada ao conferir feriados municipais e situações excepcionais."
  },
  {
    "category": "Controle de horas e banco de horas",
    "question": "Como consultar um perfil de banco de horas?",
    "answer": "A área de perfis, quando disponível, permite visualizar parâmetros e acompanhar revisões. Seguir um perfil não altera automaticamente o cálculo; é necessário atribuí-lo conforme os controles da tela."
  },
  {
    "category": "Controle de horas e banco de horas",
    "question": "Posso ver horas trabalhadas por mês ou ano?",
    "answer": "Controle de horas oferece os registros por período, e as telas de consulta aplicam filtros para localizar o mês, a quinzena e os dados disponíveis."
  },
  {
    "category": "Holerites, férias, PPR e 13º",
    "question": "Quem pode importar holerites?",
    "answer": "A importação inteligente de PDFs e a consulta aos documentos são recursos do plano Full e de acessos temporários que concedam esses recursos. No Free e no Basic, as funções podem permanecer bloqueadas."
  },
  {
    "category": "Holerites, férias, PPR e 13º",
    "question": "Como importar um PDF com vários holerites?",
    "answer": "Abra Meus Holerites > Importar, selecione o arquivo e revise a identificação dos documentos, tipos e competências antes de confirmar. O sistema tenta separar documentos reconhecidos nas páginas."
  },
  {
    "category": "Holerites, férias, PPR e 13º",
    "question": "Posso importar arquivos antigos e novos?",
    "answer": "Sim, desde que o formato seja reconhecido. Você pode enviar PDFs que reúnem múltiplas competências ou documentos individuais. Confira sempre os resultados extraídos antes de confirmar."
  },
  {
    "category": "Holerites, férias, PPR e 13º",
    "question": "O que acontece se importar o mesmo holerite duas vezes?",
    "answer": "O aplicativo possui verificações de duplicidade e revisão. Verifique documentos e competências já existentes antes de aceitar uma nova importação."
  },
  {
    "category": "Holerites, férias, PPR e 13º",
    "question": "Quais informações geram eventos automáticos?",
    "answer": "Quando há evidência suficiente, a importação pode criar eventos vinculados ao documento para salário, triênio, previdência, ESPP, dependentes e outros valores reconhecidos. A pensão exige consistência entre várias observações."
  },
  {
    "category": "Holerites, férias, PPR e 13º",
    "question": "O que fazer quando a data de pagamento não é reconhecida?",
    "answer": "Revise o PDF e os dados extraídos. O sistema pode oferecer o último dia da competência como data provisória, somente com confirmação explícita, pois pode diferir da data real de pagamento."
  },
  {
    "category": "Holerites, férias, PPR e 13º",
    "question": "Como visualizar ou baixar vários holerites?",
    "answer": "Em Meus Holerites, selecione os documentos e escolha entre arquivo PDF agrupado e downloads individuais, quando disponíveis. O arquivo baixado fica sob a segurança do seu dispositivo."
  },
  {
    "category": "Holerites, férias, PPR e 13º",
    "question": "Como excluir um holerite importado?",
    "answer": "Localize o documento em Meus Holerites e utilize a ação de exclusão com confirmação. Eventos automáticos vinculados podem ser removidos; dados manuais independentes devem ser preservados."
  },
  {
    "category": "Holerites, férias, PPR e 13º",
    "question": "Como são tratados férias, 13º e PPR?",
    "answer": "O Payrep mantém os tipos de pagamento separados e pode conciliá-los com o holerite mensal quando houver dados suficientes. Verifique rubricas, competência, adiantamentos, descontos e valores líquidos."
  },
  {
    "category": "Holerites, férias, PPR e 13º",
    "question": "O que significa conciliação pendente ou divergente?",
    "answer": "A conciliação compara projeções e informações registradas nos documentos. Uma divergência precisa de revisão; ausência de rubrica não equivale necessariamente a valor zero."
  },
  {
    "category": "Histórico, gráficos e Informe IR",
    "question": "Como usar o Histórico salarial?",
    "answer": "Abra Histórico salarial e selecione o ano ou Todos os anos. O conteúdo depende dos eventos manuais e dos documentos importados disponíveis na conta."
  },
  {
    "category": "Histórico, gráficos e Informe IR",
    "question": "O que representam os gráficos de Análises?",
    "answer": "São visualizações de remuneração, benefícios, FGTS, IRRF, INSS e outros indicadores, conforme os dados existentes. Diferencie valores projetados de valores confirmados por documento."
  },
  {
    "category": "Histórico, gráficos e Informe IR",
    "question": "Como consultar gráficos de 13º salário e PPR?",
    "answer": "Abra Análises e selecione o indicador correspondente. As parcelas de líquido, pensão e impostos são apresentadas quando identificadas, e a ausência de documento pode limitar o gráfico."
  },
  {
    "category": "Histórico, gráficos e Informe IR",
    "question": "Como funciona o gráfico de FGTS?",
    "answer": "O relatório exibe os meses e valores identificados nos registros disponíveis. Não substitui o extrato oficial do FGTS e não presume depósitos não comprovados."
  },
  {
    "category": "Histórico, gráficos e Informe IR",
    "question": "O que é o Informe IR do Payrep?",
    "answer": "A área Informe IR permite acompanhar informações fiscais e, conforme o plano, guardar documentos pessoais em área privada. Não substitui o informe oficial emitido pela fonte pagadora nem a declaração enviada à Receita."
  },
  {
    "category": "Histórico, gráficos e Informe IR",
    "question": "O que fazer quando um indicador não tem valor?",
    "answer": "Confira o período escolhido, o tipo de rubrica e os documentos importados. Sem evidência suficiente, o Payrep pode deixar o indicador sem valor em vez de inventar um zero."
  },
  {
    "category": "Pep Ajuda e consultas pessoais",
    "question": "Qual a diferença entre Pep Ajuda e Pergunte ao Pep?",
    "answer": "Pep Ajuda esclarece como usar o Payrep e não acessa seus dados financeiros. Pergunte ao Pep é o assistente pessoal, disponível conforme o plano, que pode consultar dados da sua própria conta."
  },
  {
    "category": "Pep Ajuda e consultas pessoais",
    "question": "O Pep Ajuda pode analisar meu salário ou holerite?",
    "answer": "Não. O modo Ajuda não consulta informações pessoais; utilize Pergunte ao Pep para consultas autorizadas pelo plano. Evite enviar documentos completos ou credenciais por mensagens."
  },
  {
    "category": "Pep Ajuda e consultas pessoais",
    "question": "O que o Pep pessoal consegue consultar no Basic?",
    "answer": "No Basic, o Pep pode utilizar eventos e parâmetros salariais associados à própria conta autenticada, conforme a consulta e as regras disponíveis. Ele não consulta os PDFs originais dos holerites."
  },
  {
    "category": "Pep Ajuda e consultas pessoais",
    "question": "O que muda no Pep pessoal do Full?",
    "answer": "Além dos recursos do Basic, o Full permite consultas a resumos e rubricas de holerites importados, sempre com limitação à conta autenticada e aos dados disponíveis."
  },
  {
    "category": "Pep Ajuda e consultas pessoais",
    "question": "As respostas do Pep são sempre corretas?",
    "answer": "Não. A inteligência artificial pode errar ou interpretar incompletamente os dados. Confira números relevantes nos documentos, cálculos determinísticos do Payrep e fontes oficiais."
  },
  {
    "category": "Pep Ajuda e consultas pessoais",
    "question": "Como funcionam os limites de perguntas do Pep?",
    "answer": "Existem limites diários configuráveis por modo e plano e um limite global de consumo. Administradores têm exceção de uso. A ausência de contador visual não elimina o controle de limite no servidor."
  },
  {
    "category": "Pep Ajuda e consultas pessoais",
    "question": "Onde ficam minhas conversas com o Pep?",
    "answer": "No modo pessoal, utilize Salvar conversa e Histórico para registrar e reabrir conversas. O Pep Ajuda não oferece o mesmo histórico salvo; as mensagens permanecem na conversa atual enquanto a tela está aberta."
  },
  {
    "category": "Pep Ajuda e consultas pessoais",
    "question": "Por que o Pep pode estar indisponível?",
    "answer": "A disponibilidade depende de autenticação, plano, limites configurados e serviço externo de IA. Se aparecer uma mensagem de limite ou indisponibilidade, verifique o aviso e tente novamente depois."
  },
  {
    "category": "Planos, assinaturas e pagamentos",
    "question": "Quais são os planos do Payrep?",
    "answer": "O Payrep possui Free, Basic e Full. O Free inclui controle manual e ajuda; o Basic acrescenta Pep pessoal e Informe IR privado; o Full inclui importação de holerites e acesso avançado aos dados importados. Consulte a tela Assinatura para preços e disponibilidade."
  },
  {
    "category": "Planos, assinaturas e pagamentos",
    "question": "Por que não consigo contratar o Full?",
    "answer": "A liberação de checkout é controlada separadamente por plano. Mesmo que o Full apareça na lista, ele pode ainda não estar disponível para novas contratações."
  },
  {
    "category": "Planos, assinaturas e pagamentos",
    "question": "Onde vejo preços e a situação da minha assinatura?",
    "answer": "Clique no avatar > Assinatura. A tela apresenta planos, preços de contratação quando disponíveis, plano atual, histórico de cobranças e checkouts."
  },
  {
    "category": "Planos, assinaturas e pagamentos",
    "question": "Como funciona o pagamento no Asaas?",
    "answer": "Após revisar os dados cadastrais, o Payrep direciona ao checkout hospedado do Asaas. A cobrança pode ser real, com renovação mensal. Confira o valor e as condições antes de confirmar."
  },
  {
    "category": "Planos, assinaturas e pagamentos",
    "question": "Paguei no Asaas, mas meu plano ainda está Free. E agora?",
    "answer": "O retorno do checkout não comprova pagamento. Em Assinatura, utilize Verificar pagamento e aguarde a conciliação com o Asaas. Não repita a compra imediatamente; abra chamado se houver divergência."
  },
  {
    "category": "Planos, assinaturas e pagamentos",
    "question": "Como cancelar a renovação automática?",
    "answer": "Abra avatar > Assinatura e procure a ação de interromper a renovação, quando disponível. A confirmação no Asaas interrompe cobranças futuras, mas cobranças já geradas e o período pago seguem suas regras próprias."
  },
  {
    "category": "Planos, assinaturas e pagamentos",
    "question": "Posso usar um código promocional?",
    "answer": "Na etapa de assinatura, informe um código válido para o plano escolhido. Se o código for aprovado, o acesso promocional é concedido pelo período definido, sem pagamento, e o plano anterior retorna conforme sua vigência."
  },
  {
    "category": "Planos, assinaturas e pagamentos",
    "question": "O Payrep oferece período de teste gratuito?",
    "answer": "Um administrador pode conceder teste do Full a usuários elegíveis, sem cobrança nem cadastro de cartão. A duração e o encerramento são definidos pelas regras do teste."
  },
  {
    "category": "Planos, assinaturas e pagamentos",
    "question": "Minha assinatura é apagada ao excluir dados salariais?",
    "answer": "Não. Excluir meus dados não cancela o plano pago. Para encerrar a conta, pode ser necessário cancelar a renovação e regularizar cobranças pendentes."
  },
  {
    "category": "Planos, assinaturas e pagamentos",
    "question": "Receberei reembolso ao cancelar?",
    "answer": "Interromper a renovação não significa estorno automático. Qualquer análise de devolução depende da cobrança e das condições aplicáveis; procure o suporte para revisar casos específicos."
  },
  {
    "category": "Suporte, privacidade e encerramento",
    "question": "Como abrir um chamado de suporte?",
    "answer": "Abra avatar > Ajuda > Abrir chamado, selecione categoria, preencha assunto e descrição e registre. O chamado fica associado à sua conta e pode receber respostas e notificações por e-mail."
  },
  {
    "category": "Suporte, privacidade e encerramento",
    "question": "Onde acompanho os chamados e respostas?",
    "answer": "Em Ajuda > Meus chamados, utilize os filtros de ano e status. Ao expandir um chamado, consulte a conversa e responda enquanto ele estiver aberto."
  },
  {
    "category": "Suporte, privacidade e encerramento",
    "question": "Quais são os status de um chamado?",
    "answer": "Os estados de acompanhamento incluem Aberto, Em atendimento e Finalizado. Ao ser finalizado, o histórico permanece consultável conforme a política vigente, e a conversa pode ficar somente leitura."
  },
  {
    "category": "Suporte, privacidade e encerramento",
    "question": "Posso responder às notificações de suporte por e-mail?",
    "answer": "O Payrep pode encaminhar avisos de suporte por e-mail. A possibilidade de responder diretamente depende do tipo de mensagem e da configuração do serviço; quando necessário, utilize a conversa do chamado."
  },
  {
    "category": "Suporte, privacidade e encerramento",
    "question": "Como entrar em contato se não consigo abrir um chamado?",
    "answer": "Envie uma mensagem para suporte@payrep.com.br. Não encaminhe senha, código de autenticação ou cópia integral do holerite."
  },
  {
    "category": "Suporte, privacidade e encerramento",
    "question": "Quem é o responsável pelo Payrep?",
    "answer": "O controlador informado na Política de Privacidade é Pedro Henrique Vieira de Mello, pessoa física. Solicitações sobre dados e privacidade podem ser enviadas a suporte@payrep.com.br."
  },
  {
    "category": "Suporte, privacidade e encerramento",
    "question": "Como meus dados pessoais são protegidos?",
    "answer": "O Payrep separa os registros por conta, usa autenticação, regras de acesso no banco e armazenamento privado para documentos. A proteção também depende da segurança do dispositivo e das credenciais do usuário."
  },
  {
    "category": "Suporte, privacidade e encerramento",
    "question": "Qual a diferença entre Excluir meus dados e Excluir minha conta?",
    "answer": "Excluir meus dados remove registros salariais e documentos dentro do escopo da operação, mas mantém cadastro e assinatura. Excluir minha conta segue o fluxo de encerramento e suspensão de acesso; não equivale à eliminação definitiva de todos os registros."
  },
  {
    "category": "Suporte, privacidade e encerramento",
    "question": "Posso excluir minha conta com assinatura ativa?",
    "answer": "Se a renovação paga estiver ativa, o encerramento poderá ser bloqueado até confirmar o cancelamento. Cobranças pendentes ou divergentes também podem exigir regularização."
  },
  {
    "category": "Suporte, privacidade e encerramento",
    "question": "Como solicitar exclusão definitiva de dados cadastrais?",
    "answer": "A exclusão permanente automática não está disponível no aplicativo. Solicite revisão e atendimento de direitos pelo e-mail suporte@payrep.com.br, observadas obrigações legais de retenção."
  },
  {
    "category": "Suporte, privacidade e encerramento",
    "question": "Por quanto tempo meus dados ficam armazenados?",
    "answer": "Holerites e dados salariais permanecem durante o uso até a solicitação de exclusão aplicável; dados de assinatura e registros de pagamento podem ser retidos por exigências legais. A política detalha os critérios e o canal para dúvidas; não há promessa de exclusão automática imediata de backups."
  },
  {
    "category": "Suporte, privacidade e encerramento",
    "question": "Onde encontro a Política de Privacidade e os Termos de Uso?",
    "answer": "Os links Sobre, Privacidade e Termos de Uso aparecem no rodapé do menu, além das páginas públicas payrep.com.br/sobre, /privacidade e /termos."
  },
  {
    "category": "Administração da plataforma",
    "question": "Como gerenciar usuários e aprovações?",
    "answer": "Contas com perfil administrador encontram Gestão de usuários e Política de cadastro em Configurações. Alterações de permissões devem respeitar as regras de segurança e autenticação adicional."
  },
  {
    "category": "Administração da plataforma",
    "question": "Onde ajusto limites do Pep?",
    "answer": "No perfil administrador, abra Configurações do Pep para definir limites diários de Ajuda, Basic, Full e total global. O uso pode ser acompanhado por indicadores de consumo de Neurons."
  },
  {
    "category": "Administração da plataforma",
    "question": "Onde administro planos, códigos e testes gratuitos?",
    "answer": "No menu administrativo Planos e Assinaturas ficam os controles de preços, disponibilidade de checkout, códigos promocionais e concessões de teste, de acordo com permissões do ambiente."
  },
  {
    "category": "Administração da plataforma",
    "question": "Como vejo as cobranças do Asaas?",
    "answer": "Administradores autorizados utilizam Financeiro para consultar extrato, pagamentos e gráficos de receita do Asaas vinculado ao ambiente. Os dados de produção não devem ser misturados aos registros de teste."
  },
  {
    "category": "Administração da plataforma",
    "question": "Onde ficam os documentos coletivos e regras de banco de horas?",
    "answer": "A administração possui controles de biblioteca de documentos e perfis de banco de horas. Uma atualização de perfil não deve substituir automaticamente regras já atribuídas sem ação específica."
  },
  {
    "category": "Administração da plataforma",
    "question": "Por que não consigo alterar configurações administrativas?",
    "answer": "Funções administrativas dependem do perfil ativo e, em operações sensíveis, de verificação adicional de segurança. Verifique sua sessão e os requisitos de MFA."
  },
  {
    "category": "Suporte, privacidade e encerramento",
    "question": "Como encontrar respostas no FAQ por palavras-chave?",
    "answer": "Abra avatar > Ajuda e expanda Perguntas frequentes (FAQ). Digite palavras-chave no campo Pesquisar respostas: o Payrep procura automaticamente em categorias, perguntas e respostas, sem enviar a pesquisa ao servidor. Sem pesquisa, abra a categoria desejada e depois a pergunta; ambas começam recolhidas."
  }
,{"category":"Planos, assinaturas e pagamentos","question":"Como visualizar a diferença entre plano contratado e acesso efetivo?","answer":"Na seção Assinatura é mostrado o plano financeiro e, quando houver, o acesso promocional ou definido pelo administrador. A cobrança no Asaas não é alterada por concessões gratuitas ou ajustes de permissões."},
{"category":"Planos, assinaturas e pagamentos","question":"O que acontece quando um administrador revoga meu acesso promocional?","answer":"A revogação encerra imediatamente aquele benefício, preservando seu histórico. O acesso efetivo passa a considerar seu plano contratado e outras permissões vigentes; não cancela pagamentos ou renovações."},
{"category":"Administração da plataforma","question":"Como conceder acesso promocional Basic ou Full a um usuário?","answer":"Na área Administração > Planos e Assinaturas > Acesso promocional, escolha um usuário aprovado pelo nome ou e-mail, selecione Basic ou Full e a duração. Confirme a concessão. A tabela exibe início, fim, dias restantes, status e revogação. O recurso não cria cobrança."},
{"category":"Administração da plataforma","question":"Como consultar quem resgatou um código promocional e revogar?","answer":"Abra Administração > Planos e Assinaturas > Códigos promocionais. A lista mostra os usuários, códigos, planos, datas e dias restantes. Utilize a ação de revogação individual para interromper um benefício, sem excluir o histórico do resgate."},
{"category":"Administração da plataforma","question":"Como alterar manualmente o plano de um usuário?","answer":"Acesse Administração > Planos e Assinaturas > Planos por usuário. Busque por nome ou e-mail, selecione Free, Basic ou Full e salve, ou escolha Automático para retornar ao cálculo de assinaturas e promoções. A alteração de acesso não modifica cobranças ou assinaturas do Asaas."}
,{"category":"Planos, assinaturas e pagamentos","question":"O limite de consultas ao Pep muda depois que eu assino?","answer":"O limite diário pessoal de consultas ao Pep Basic ou Full é registrado como mínimo ao criar o checkout. Enquanto a assinatura estiver ativa, reduções posteriores aplicadas pelo administrador não diminuem esse mínimo. Se o limite geral aumentar, a franquia efetiva poderá aumentar também. O limite global compartilhado e a disponibilidade do provedor externo continuam aplicáveis; as cotas reiniciam às 00h UTC e não acumulam."},
{"category":"Planos, assinaturas e pagamentos","question":"Onde vejo todos os benefícios e limites dos planos?","answer":"Na tela Assinatura, clique em Ver benefícios e limites dentro do card Free, Basic ou Full. A tela apresenta os recursos incluídos, restrições de importação de holerites e consultas pessoais ao Pep, as franquias atuais do servidor e, quando aplicável, a franquia mínima preservada na assinatura."},
{"category":"Administração da plataforma","question":"Como filtrar usuários por plano na administração?","answer":"Abra Planos e Assinaturas > Planos por usuário. Clique no card Free, Basic ou Full para filtrar por acesso efetivo. O formulário Alterar acesso de um usuário fica separado da lista Usuários e assinaturas cadastradas. Administradores não contam como assinantes."}
];

export const PAYREP_SUPPORT_KNOWLEDGE="PRODUTO: Payrep, aplicativo brasileiro de gestão individual de remuneração CLT. As instruções abaixo são do aplicativo, não aconselhamento jurídico ou contábil.\nAMBIENTE: preços, disponibilidade de checkout e limites devem ser conferidos na tela da conta; não exponha detalhes de ambientes internos, não presuma que um plano esteja aberto para venda.\nNAVEGAÇÃO: menu principal Visão geral, Histórico salarial, Controle de horas, Eventos e vigências, Análises, Informe IR, Pergunte ao Pep, Meus Holerites, Definições. Avatar: Meu cadastro, Assinatura, Segurança, Ajuda. Rodapé: Sobre, Privacidade e Termos.\nVISÃO GERAL: projeção por mês/ano; indicadores configuráveis e reordenáveis; cartões podem incluir pensão, VR, previdência, auxílio-creche, ESPP. Adiantamento e líquido final compõem total recebido sem dupla contagem.\nDEFINIÇÕES: Base/cidade, remuneração, descontos e configuração dos cartões. EVENTOS E VIGÊNCIAS: salário, triênio, benefícios, dependentes, pensão, previdência percentual, ESPP, férias, PPR e 13º com datas de validade.\nCONTROLE DE HORAS: escolha ano/mês/quinzena, horários e intervalos; salvar ou resetar quinzena; banco de horas depende dos fatores e perfis atribuídos, feriados e local, não de regra universal.\nMEUS HOLERITES: importação inteligente de PDFs restrita ao Full; revisão de competências e rubricas; eventos automáticos vinculados; download individual ou agrupado; reconciliação de férias, 13º e PPR; não presumir valor zero para rubrica ausente.\nANÁLISES: filtros e gráficos por período para salário, benefícios, IRRF, INSS, FGTS, PPR, férias e 13º conforme evidência. INFORME IR: documento pessoal e informações auxiliares, não informe oficial.\nPEP AJUDA: modo para dúvidas de utilização do Payrep, sem ler dados individuais; todos os planos sujeitos a limites. PERGUNTE AO PEP: modo pessoal Basic/Full; Basic lê dados manuais e eventos, Full também resumos de holerites, sempre usuário autenticado e dados disponíveis. O histórico salvo pertence ao modo pessoal.\nASSINATURAS: Free, Basic e Full; contratação quando habilitada, checkout real no Asaas, conferência de status por webhook e conciliação; retorno não comprova pagamento. Cancelamento interrompe renovação futura, não gera reembolso automático. Códigos promocionais e concessões administrativas Basic ou Full com início, término e revogação individual existem. Administradores podem ajustar o plano efetivo independentemente do contrato financeiro; isso não altera a cobrança nem cancela a assinatura do Asaas. O usuário encontra todos os benefícios e limitações no botão Ver benefícios e limites da tela Assinatura. Consultas pessoais do Pep são limitadas por dia e plano; o limite é registrado ao iniciar o checkout e preservado como mínimo durante a assinatura ativa, mesmo após reduções administrativas. O limite global compartilhado e a disponibilidade do provedor de IA ainda se aplicam. A cota reinicia às 00h UTC sem acúmulo.\nSUPORTE: avatar > Ajuda; FAQ por categorias recolhidas e pesquisa instantânea local de palavras-chave nas perguntas e respostas; Pep Ajuda, abrir chamado, acompanhar conversa e status, avisos por e-mail. Contato suporte@payrep.com.br.\nPRIVACIDADE: controlador Pedro Henrique Vieira de Mello; dados financeiros segregados por conta, MFA quando necessário e documentos privados. Excluir dados financeiros não encerra a assinatura; encerramento de conta suspende acesso e pode exigir cancelamento prévio. Exclusão permanente cadastral requer pedido ao suporte.\nRESPOSTAS: a ausência de dado não prova valor zero. Nunca afirme que fez ações na conta, que consultou holerites no modo Ajuda, que uma cobrança foi paga sem verificação nem que a IA substitui documentação oficial.";

const STOP=new Set('para como onde qual quais pode posso pelo pela com sem uma uns umas que quando quem por das dos nos nas este esta isto está meu minha seu sua seus suas todos todas mais usar faço fazer tenho estou quero quais algo usar acessar existe ainda aplicativo payrep existe será'.split(' '))
const terms=(value:string):string[]=>[...new Set(value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().match(/[a-z0-9]{3,}/g)||[])].filter(x=>!STOP.has(x))
/** Select the most relevant FAQ answers instead of sending every item to the AI.
 * Keeps the assistant informed while limiting the Cloudflare token/Neuron cost.
 */
export function buildPepHelpContext(question:string,priorUserText=''):string{
 const words=terms((question+' '+priorUserText.slice(-450)).slice(0,950))
 const scored=PAYREP_SUPPORT_FAQ.map((entry,i)=>{
  const title=terms(entry.question+' '+entry.category)
  const answer=terms(entry.answer)
  const match=words.reduce((n,word)=>n+(title.includes(word)?5:0)+(answer.includes(word)?1:0),0)
  return {entry,i,score:match}
 }).sort((a,b)=>b.score-a.score||a.i-b.i)
 const relevant=scored.filter(x=>x.score>0).slice(0,7)
 const picked=relevant.length?relevant:scored.slice(0,4)
 const details=picked.map(x=>'['+x.entry.category+'] '+x.entry.question+' '+x.entry.answer).join('\n')
 return PAYREP_SUPPORT_KNOWLEDGE+'\n\nPERGUNTAS E RESPOSTAS DE REFERÊNCIA:\n'+details
}
