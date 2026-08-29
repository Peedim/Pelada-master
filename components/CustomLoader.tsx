import React from 'react';

const CustomLoader: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-900 gap-4">
      {/* Estrutura HTML do Loader */}
      <div id="ajaxloader">
        <div className="outer"></div>
        <div className="soccer">
          <img src="https://i.imgur.com/76KmMMg.png" alt="Bola" />
        </div>
      </div>
      
      {/* Texto de carregamento */}
      <p className="text-slate-400 font-bold tracking-widest animate-pulse text-sm uppercase">
        Carregando...
      </p>

      {/* CSS Embutido */}
      <style>{`
        #ajaxloader {
          position: relative;
          width: 60px;
          height: 60px;
          margin: 0 auto;
        }

        #ajaxloader .outer {
          position: absolute;
          top: 0;
          left: 0;
          border: 4px solid rgba(0, 229, 183, 0.9); /* Ciano/Verde */
          opacity: 0.9;
          width: 60px;
          height: 60px;
          border-top-color: transparent;
          border-bottom-color: transparent;
          border-radius: 50%;
          box-shadow: 0 0 35px rgba(0, 61, 76, 0.9);
          animation: spin-right 0.6s linear infinite normal;
        }

        .soccer {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .soccer img {
          width: 40px; /* Tamanho da bola ajustado */
          height: auto;
          display: block;
          animation: spin-right 1.3s linear infinite normal;
        }

        @keyframes spin-right {
          from {
            transform: rotate(0deg);
            opacity: 0.5;
          }
          50% {
            transform: rotate(180deg);
            opacity: 1;
          }
          to {
            transform: rotate(360deg);
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );
};

export default CustomLoader;