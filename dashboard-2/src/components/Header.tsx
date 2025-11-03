import { Link } from 'react-router-dom';
import { Heart, Menu, Home } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { motion } from 'framer-motion';
import LanguageSwitcher from './LanguageSwitcher';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';
import { Switch } from './ui/switch';
import { Label } from './ui/label';

const Header = () => {
  const { strings, lowDataMode, setLowDataMode } = useLanguage();

  const NavLinks = () => (
    <>
      <Link to="/" className="text-foreground hover:text-primary transition-colors flex items-center gap-2 px-3 py-2 rounded-md hover:bg-primary/10 text-sm md:text-base">
        <Home className="h-4 w-4" />
        <span className="sr-only">{strings.home}</span>
      </Link>
      <Link to="/prescriptions" className="text-foreground hover:text-primary transition-colors px-3 py-2 rounded-md hover:bg-primary/10 text-sm md:text-base">
        {strings.prescriptions}
      </Link>
      <Link to="/hospitals" className="text-foreground hover:text-primary transition-colors px-3 py-2 rounded-md hover:bg-primary/10 text-sm md:text-base">
        {strings.hospitals}
      </Link>
      <Link to="/vitals" className="text-foreground hover:text-primary transition-colors px-3 py-2 rounded-md hover:bg-primary/10 text-sm md:text-base">
        {strings.vitals}
      </Link>
    </>
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b-2 border-primary/10 glass-card shadow-premium">
      <div className="container flex h-16 md:h-20 items-center justify-between px-3 md:px-4">
        {/* Logo Section - Improved Mobile Alignment */}
        <Link to="/" className="flex items-center gap-2 md:gap-3 group flex-shrink-0">
          <motion.div
            whileHover={{ scale: 1.1, rotate: 5 }}
            className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0"
          >
            <Heart className="h-5 w-5 md:h-6 md:w-6 text-white" fill="currentColor" />
          </motion.div>
          <div className="flex flex-col justify-center min-w-0">
            <span className="text-lg md:text-2xl font-bold gradient-text leading-tight truncate">{strings.title}</span>
            <span className="text-xs text-muted-foreground leading-tight hidden sm:block">{strings.subtitle}</span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-6 flex-1 justify-center">
          <NavLinks />
        </nav>

        {/* Right Side Controls */}
        <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
          {/* Low Data Mode Toggle - Desktop */}
          <div className="hidden lg:flex items-center gap-3 bg-muted/50 px-3 py-2 rounded-xl border border-border/50">
            <Switch
              id="low-data"
              checked={lowDataMode}
              onCheckedChange={setLowDataMode}
            />
            <Label htmlFor="low-data" className="text-sm cursor-pointer font-medium whitespace-nowrap">
              {strings.lowDataMode}
            </Label>
          </div>

          {/* Language Switcher */}
          <div className="flex-shrink-0">
            <LanguageSwitcher />
          </div>

          {/* Mobile Menu */}
          <Sheet>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="outline" size="icon" className="h-9 w-9 md:h-10 md:w-10">
                <Menu className="h-4 w-4 md:h-5 md:w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 sm:w-96">
              <div className="flex flex-col gap-6 mt-6">
                {/* Mobile Logo in Menu */}
                <div className="flex items-center gap-3 pb-4 border-b">
                  <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center shadow-lg">
                    <Heart className="h-5 w-5 text-white" fill="currentColor" />
                  </div>
                  <div>
                    <div className="text-xl font-bold gradient-text">{strings.title}</div>
                    <div className="text-sm text-muted-foreground">{strings.subtitle}</div>
                  </div>
                </div>

                <nav className="flex flex-col gap-4">
                  <NavLinks />
                </nav>

                <div className="flex items-center gap-2 pt-4 border-t">
                  <Switch
                    id="low-data-mobile"
                    checked={lowDataMode}
                    onCheckedChange={setLowDataMode}
                  />
                  <Label htmlFor="low-data-mobile" className="text-sm cursor-pointer">
                    {strings.lowDataMode}
                  </Label>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};

export default Header;
