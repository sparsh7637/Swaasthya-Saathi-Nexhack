import { Github, Linkedin, Mail } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-foreground text-white py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          {/* Main content */}
          <div className="space-y-4">
            <h3 className="text-2xl font-bold font-poppins">
              Swaasthya Saathi
            </h3>
            <p className="text-white/70 font-inter max-w-2xl mx-auto">
              Bridging the gap between healthcare and technology for a healthier India. 
              Supporting government initiatives for universal healthcare access.
            </p>
          </div>

          {/* Government partnership note */}
          <div className="border-t border-white/20 pt-8">
            <div className="bg-white/5 rounded-lg p-6 border border-white/10">
              <p className="text-white/80 font-inter text-sm leading-relaxed">
                🇮🇳 Built for Digital India initiative • Supporting Ayushman Bharat mission • 
                Empowering healthcare accessibility across all Indian languages
              </p>
            </div>
          </div>

          {/* Copyright */}
          <div className="border-t border-white/20 pt-8 text-white/60 text-sm font-inter">
            <p className="flex items-center justify-center space-x-2">
              <span>Made for India's healthcare future</span>
            </p>
            <p className="mt-2">
              © 2024 Swaasthya Saathi. Supporting government healthcare initiatives.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;