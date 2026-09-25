export interface EducationalMessageTemplate {
  id: string
  tema: string
  tipo: 'educativo' | 'oferta'
  ramo: string
  titulo: string
  objetivo: string
  sugestaoAssunto: string
  sugestaoCorpo: string
}

export const BANCO_MENSAGENS_EDUCATIVAS_E_OFERTAS: EducationalMessageTemplate[] = [
  {
    id: 'edu-reboque-24h',
    tema: 'Como acionar o reboque 24h sem dor de cabeça',
    tipo: 'educativo',
    ramo: 'Auto',
    titulo: 'Guia Prático de Acionamento de Reboque e Guincho',
    objetivo:
      'Instruir o segurado sobre o canal correto (WhatsApp/0800 da seguradora), conferir limite de km e repassar localização precisa.',
    sugestaoAssunto: '{nome_cliente}, dicas essenciais para acionar o guincho 24h sem estresse 🚗',
    sugestaoCorpo: `Olá, {nome_cliente}!

Na correria do dia a dia, imprevistos no trânsito podem acontecer. Por isso, preparamos 3 passos rápidos para você acionar a assistência 24h do seu seguro sem complicação:

1. Tenha em mãos a placa do seu veículo e o endereço exato (ou envie a localização fixa pelo WhatsApp oficial da seguradora).
2. Se estiver em rodovia concessionada, utilize primeiro os telefones de emergência da pista (SOS da rodovia costuma chegar em minutos).
3. Verifique sempre no seu cartão da apólice o limite de km contratado para planejar o destino do reboque.

Nós da CRED10MIX estamos sempre com você. Salve o nosso WhatsApp para qualquer orientação!

Atenciosamente,
Equipe CRED10MIX Corretora de Seguros`,
  },
  {
    id: 'edu-franquia-quando-usar',
    tema: 'Quando realmente vale a pena usar a franquia?',
    tipo: 'educativo',
    ramo: 'Auto',
    titulo: 'Descomplicando a Franquia do Seguro Auto',
    objetivo:
      'Orientar quando compensa acionar a seguradora para reparo próprio vs. pequenos arranhões, e reforçar que para terceiros não se paga franquia do segurado.',
    sugestaoAssunto: '{nome_cliente}: Você sabe quando realmente compensa pagar a franquia? 🤔',
    sugestaoCorpo: `Olá, {nome_cliente}!

Uma das dúvidas mais comuns entre nossos clientes é: "Bati o carro, devo acionar o seguro?".

Regra de ouro prática da CRED10MIX:
• Se o orçamento do conserto for MENOR ou muito próximo do valor da sua franquia, geralmente vale a pena pagar no particular para não perder a sua Classe de Bônus na próxima renovação.
• Se o prejuízo for alto, acionar a seguradora é a melhor escolha: você paga apenas a franquia estipulada e a seguradora cobre todo o restante!
• Importante: caso a colisão tenha envolvido terceiros, a cobertura de Danos Materiais a Terceiros geralmente NÃO exige pagamento de franquia pelo segurado.

Antes de qualquer decisão, fale conosco pelo WhatsApp! Orientamos você na melhor estratégia para economizar.

Atenciosamente,
Equipe CRED10MIX Corretora de Seguros`,
  },
  {
    id: 'edu-seguro-vidros',
    tema: 'Como funciona a cobertura de vidros, faróis e retrovisores?',
    tipo: 'educativo',
    ramo: 'Auto',
    titulo: 'Seguro de Vidros: Reparo Rápido e Franquia Reduzida',
    objetivo:
      'Explicar que quebra de para-brisa ou retrovisor tem franquia barata e não afeta bônus.',
    sugestaoAssunto: '{nome_cliente}, pedra no para-brisa? Veja como funciona o seguro de vidros',
    sugestaoCorpo: `Olá, {nome_cliente}!

Uma pedrinha na estrada atingiu o para-brisa do seu carro? Não se preocupe!

A cobertura de vidros da sua apólice oferece vantagens exclusivas:
• Franquia reduzida e muito acessível para troca de vidros, faróis, lanternas e retrovisores.
• Em caso de trincas pequenas, o reparo do para-brisa é gratuito e feito em menos de 40 minutos em oficinas credenciadas.
• O acionamento de vidros NÃO reduz a sua Classe de Bônus na renovação!

Conte com a CRED10MIX para direcionar o agendamento mais cômodo para você.

Atenciosamente,
Equipe CRED10MIX Corretora de Seguros`,
  },
  {
    id: 'cross-auto-para-residencial',
    tema: 'Oferta de Seguro Residencial para Clientes de Seguro Auto',
    tipo: 'oferta',
    ramo: 'Residencial',
    titulo: 'Proteja seu Lar pelo Preço de um Cafezinho',
    objetivo:
      'Cross-sell consultivo para quem tem auto mas não tem seguro residencial, destacando danos elétricos, vazamentos e roubo.',
    sugestaoAssunto:
      '{nome_cliente}, seu carro já está seguro. Que tal proteger também o seu lar? 🏡',
    sugestaoCorpo: `Olá, {nome_cliente}!

Você já conta com a proteção do seu automóvel na CRED10MIX. Mas você sabia que o Seguro Residencial costuma custar menos de R$ 1,50 por dia?

Vantagens que você pode ter no seu lar:
• Danos elétricos: queima de geladeira, TV e ar-condicionado por oscilação de energia ou raios.
• Assistência 24h residencial: chaveiro, encanador, eletricista e conserto de linha branca (máquina de lavar/fogão).
• Cobertura completa contra incêndio, vendaval, vazamento de tubulações e roubo/furto.

Como você já é nosso cliente parceiro, temos condições especiais de cross-sell com as melhores seguradoras do país.

Gostaria de ver uma simulação rápida sem nenhum compromisso? Responda este e-mail ou chame no WhatsApp!

Atenciosamente,
Equipe CRED10MIX Corretora de Seguros`,
  },
  {
    id: 'cross-vida-e-familia',
    tema: 'Oferta de Seguro de Vida e Invalidez Temporária',
    tipo: 'oferta',
    ramo: 'Vida',
    titulo: 'Proteção em Vida e Tranquilidade Familiar',
    objetivo:
      'Destacar coberturas em vida como diárias de internação, doenças graves e telemedicina.',
    sugestaoAssunto: '{nome_cliente}, proteção que cuida de você em vida e de quem você ama ❤️',
    sugestaoCorpo: `Olá, {nome_cliente}!

Costumamos proteger nosso carro e nossos bens materiais, mas o nosso bem mais precioso somos nós mesmos e nossa família.

O Seguro de Vida moderno da CRED10MIX foi feito para ser usado EM VIDA:
• Diagnóstico de Doenças Graves (câncer, infarto, AVC): indenização paga direto na sua conta.
• DIT (Diária por Incapacidade Temporária): garantia de renda caso precise se afastar do trabalho por acidente ou doença.
• Telemedicina 24h sem coparticipação para você e seus dependentes.

Parcelas acessíveis a partir de pequenos valores mensais, planejados de acordo com o seu perfil.

Podemos apresentar uma proposta personalizada?

Atenciosamente,
Equipe CRED10MIX Corretora de Seguros`,
  },
  {
    id: 'cross-viagem-tranquila',
    tema: 'Oferta de Seguro Viagem Nacional e Internacional',
    tipo: 'oferta',
    ramo: 'Viagem',
    titulo: 'Viagens Nacionais e Internacionais Sem Imprevistos',
    objetivo:
      'Oferta de seguro viagem com cobertura de extravio de bagagem e despesas médico-hospitalares.',
    sugestaoAssunto: '{nome_cliente}, vai viajar nas férias? Garanta sua proteção completa ✈️',
    sugestaoCorpo: `Olá, {nome_cliente}!

Planejando sua próxima viagem a lazer ou trabalho?

Um atendimento médico no exterior ou mesmo fora do seu estado pode custar milhares de reais. Com o Seguro Viagem da CRED10MIX, você viaja com total suporte:
• Despesas médicas, hospitalares e odontológicas de urgência.
• Seguro para extravio ou atraso de bagagem.
• Regresso sanitário e assistência jurídica completa.

Faça sua cotação conosco em menos de 2 minutos antes de embarcar!

Atenciosamente,
Equipe CRED10MIX Corretora de Seguros`,
  },
]
