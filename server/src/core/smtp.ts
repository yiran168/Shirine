import type { EmailConfig } from "./email-config";
type SmtpSocket={readable:ReadableStream<Uint8Array>;writable:WritableStream<Uint8Array>;opened:Promise<unknown>;closed:Promise<unknown>;close:()=>Promise<void>;startTls:()=>SmtpSocket};
export type SmtpConnect=(address:{hostname:string;port:number},options:{secureTransport:"on"|"starttls"})=>SmtpSocket;
const bytes=new TextEncoder();
const base64=(value:string)=>btoa(String.fromCharCode(...bytes.encode(value)));
export function validateSmtpHost(host:string) {
  if(host.length>253 || !/^(?:[a-z\d](?:[a-z\d-]*[a-z\d])?\.)+[a-z]{2,63}$/i.test(host) || /(?:^|\.)(?:localhost|local|internal|test|invalid|onion)$/i.test(host)) throw new Error("SMTP 服务器必须为公网域名，不能填写 IP、内网地址或 URL");
}
export async function sendSmtp(config:EmailConfig,to:string,code:string,connectOverride?:SmtpConnect):Promise<void> {
  validateSmtpHost(config.smtpHost || "");
  if(!config.smtpUser || !config.apiKey || ![465,587,994].includes(config.smtpPort || 465)) throw new Error("SMTP 配置不完整");
  const connect=connectOverride || (await import("cloudflare:sockets")).connect as unknown as SmtpConnect;
  let socket=connect({hostname:config.smtpHost!,port:config.smtpPort || 465},{secureTransport:config.smtpPort===587?"starttls":"on"});
  let reader:ReadableStreamDefaultReader<Uint8Array> | undefined,writer:WritableStreamDefaultWriter<Uint8Array> | undefined;
  let pending="",received=0;
  let timer:ReturnType<typeof setTimeout> | undefined;
  const send=async(line:string)=>{await writer!.write(bytes.encode(line+"\r\n"));};
  async function reply(expected:number[]) {
    let result="",responseCode="";
    for(let lines=0;lines<100;lines++) {
      while(!pending.includes("\r\n")) {
        const chunk=await reader!.read();if(chunk.done) throw new Error("SMTP connection closed");
        received+=chunk.value.length;if(received>65536) throw new Error("SMTP response too large");
        pending+=new TextDecoder().decode(chunk.value);
      }
      const end=pending.indexOf("\r\n"),line=pending.slice(0,end);pending=pending.slice(end+2);
      if(!/^\d{3}[ -]/.test(line) || (responseCode && line.slice(0,3)!==responseCode)) throw new Error("Invalid SMTP response");
      responseCode=line.slice(0,3);result+=line+"\n";
      if(line[3]===" ") {if(!expected.includes(Number(responseCode))) throw new Error("SMTP request rejected");return result;}
    }
    throw new Error("SMTP multiline response limit");
  }
  const attach=()=>{reader=socket.readable.getReader();writer=socket.writable.getWriter();void socket.closed.catch(()=>{});};
  try {
    await Promise.race([
      (async()=>{
        void socket.closed.catch(()=>{});await socket.opened;attach();await reply([220]);await send("EHLO shirine.local");let capabilities=await reply([250]);
        if(config.smtpPort===587) {
          if(!/\bSTARTTLS\b/i.test(capabilities)) throw new Error("SMTP server does not support STARTTLS");
          await send("STARTTLS");await reply([220]);reader!.releaseLock();writer!.releaseLock();reader=undefined;writer=undefined;
          socket=socket.startTls();pending="";void socket.closed.catch(()=>{});await socket.opened;attach();await send("EHLO shirine.local");capabilities=await reply([250]);
        }
        if(/^250[ -]AUTH[^\n]*\bPLAIN\b/im.test(capabilities)) {await send(`AUTH PLAIN ${base64(`\0${config.smtpUser}\0${config.apiKey}`)}`);await reply([235]);}
        else if(/^250[ -]AUTH[^\n]*\bLOGIN\b/im.test(capabilities)) {await send("AUTH LOGIN");await reply([334]);await send(base64(config.smtpUser!));await reply([334]);await send(base64(config.apiKey));await reply([235]);}
        else throw new Error("SMTP server does not support password authentication");
        await send(`MAIL FROM:<${config.sender}>`);await reply([250]);await send(`RCPT TO:<${to}>`);await reply([250,251]);await send("DATA");await reply([354]);
        const body=base64(`你的 Shirine 注册验证码是 ${code}，5 分钟内有效。请勿泄露；如非本人操作，请忽略此邮件。`).match(/.{1,76}/g)!.join("\r\n");
        await send([`From: =?UTF-8?B?${base64(config.senderName)}?= <${config.sender}>`,`To: <${to}>`,`Subject: =?UTF-8?B?${base64("Shirine 注册验证码")}?=`,`Date: ${new Date().toUTCString()}`,`Message-ID: <${crypto.randomUUID()}@${config.sender.split("@")[1]}>`,"MIME-Version: 1.0","Content-Type: text/plain; charset=UTF-8","Content-Transfer-Encoding: base64","",body,"."].join("\r\n"));
        await reply([250]);
        // Acceptance has already happened. A failed QUIT must not encourage a paid resend.
        void send("QUIT").catch(()=>{});
      })(),
      new Promise<never>((_,reject)=>{timer=setTimeout(()=>{void socket.close().catch(()=>{});reject(new Error("SMTP timeout"));},12000);}),
    ]);
  } finally {if(timer!==undefined) clearTimeout(timer);try{reader?.releaseLock();writer?.releaseLock();}catch{}void socket.close().catch(()=>{});}
}
