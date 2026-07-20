import java.util.Locale;
import java.util.Scanner;
import java.util.ArrayList;
import java.util.List;

public class Main {
    private static final double TAX_LIMIT_27 = 79400.0;                      // Skattegrænsen for 27% aktieskat (79.400 kr. i 2026 for enlige)
    private static final double AKT_TAX_LOW = 0.27;
    private static final double AKT_TAX_HIGH = 0.42;
    private static final int ASK_LIMIT_2026 = 174200;
    private static final double ASK_TAX = 0.17;
    private static final Locale DK = Locale.of("da", "DK"); // Dansk talformat: punktum som tusindtalsseparator, komma som decimaltegn

    // Simpel klasse til at bære slutresultatet fra hver metode, så vi kan
    // lave en samlet sammenligning til sidst.
    static class Result {
        final String navn;
        final double slutvaerdi;
        final double nettogevinst;
        final double procentStigning;

        Result(String navn, double slutvaerdi, double nettogevinst, double procentStigning) {
            this.navn = navn;
            this.slutvaerdi = slutvaerdi;
            this.nettogevinst = nettogevinst;
            this.procentStigning = procentStigning;
        }
    }

    private record AskYearData(int year, double value, double taxThisYear) {}
    private record AktYearData(int year, double value, double realizedAt27, double realizedAt42) {}

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in).useLocale(DK);

        boolean runAgain = true;
        while (runAgain) {
            runSimulation(sc);

            System.out.println();
            runAgain = readBooleanInput(sc, "Vil du prøve igen med andre tal? (ja/nej)", "Du skal enten svare ja eller nej");
            System.out.println();
        }

        sc.close();
        System.out.println("Farvel!");
    }

    private static void runSimulation(Scanner sc) {
        System.out.println();
        int startCash = readPositiveInt(sc, "Hvor mange penge investerer du fra start? (grænsen på aktiesparekontoen er i 2026 på 174.200kr)",
                Integer.MAX_VALUE, "Du kan ikke investere et negativ beløb. Prøv igen");

        int years = readPositiveInt(sc, "Hvor mange år ønsker du at investere pengene?",
                100, "Antal år skal være mellem 1 og 100. Prøv igen");

        double yearlyReturnPercent = readPositiveDouble(sc, "Hvad forventer du det gennemsnitlige årlige afkast i procent vil være? (det gennemsnitlige afkast på det globale aktiemarked er omkring 7-9%)",
                "Du kan ikke have et negativt årligt afkast. Prøv igen");
        double yearlyReturnFactor = (yearlyReturnPercent / 100.0) + 1.0;

        boolean runAsk = readBooleanInput(sc, "Vil du se resultatet fra en Aktiesparekonto? (ja/nej)",
                "Du skal enten svare ja eller nej");

        boolean payTaxExternally = false;
        Result askResult = null;

        if (runAsk) {
            while (startCash > ASK_LIMIT_2026) {
                startCash = readPositiveInt(sc, "Dit startbeløb overstiger ASK-grænsen på 174.200 kr. Indtast et lavere beløb for ASK-beregningen:",
                        ASK_LIMIT_2026, "Beløbet er ikke gyldigt. Prøv igen.");
            }

            payTaxExternally = readBooleanInput(sc, "Vil du betale den årlige lagerskat ved indbetaling af frie midler? (ja/nej)",
                    "Du skal enten svare ja eller nej");
            askResult = ask(years, yearlyReturnFactor, startCash, payTaxExternally);
        }

        System.out.println();
        boolean runAkt = readBooleanInput(sc, "Vil du se resultatet fra et almindeligt aktiedepot? (ja/nej)",
                "Du skal enten svare ja eller nej");
        Result aktResult = null;

        if (runAkt) {
            //Vi går ud fra at hvis man har tænkt sig at indskyde penge til betaling af skat på ASK,
            //vil man i stedet investere de penge her (payTaxExternally)
            //Man vil altid bruge den optimale realiserings-strategi (harvestGains: true)
            aktResult = akt(years, yearlyReturnFactor, startCash, payTaxExternally, true);
        }

        // Endelig sammenligning, hvis begge blev kørt
        if (askResult != null && aktResult != null) {
            System.out.println();
            System.out.println("============SAMLET SAMMENLIGNING============");
            System.out.printf(DK, "%-20s %18s %18s %10s%n", "Model", "Slutværdi", "Nettogevinst", "Stigning");
            System.out.printf(DK, "%-20s %,18.0f %,18.0f %9.1f%%%n", askResult.navn, askResult.slutvaerdi, askResult.nettogevinst, askResult.procentStigning);
            System.out.printf(DK, "%-20s %,18.0f %,18.0f %9.1f%%%n", aktResult.navn, aktResult.slutvaerdi, aktResult.nettogevinst, aktResult.procentStigning);

            if (askResult.slutvaerdi > aktResult.slutvaerdi) {
                double diff = askResult.slutvaerdi - aktResult.slutvaerdi;
                System.out.printf(DK, "%n-> Aktiesparekontoen vinder med %,.0f kr. mere i slutværdi.%n", diff);
            } else if (aktResult.slutvaerdi > askResult.slutvaerdi) {
                double diff = aktResult.slutvaerdi - askResult.slutvaerdi;
                System.out.printf(DK, "%n-> Det almindelige aktiedepot vinder med %,.0f kr. mere i slutværdi.%n", diff);
            } else {
                System.out.println();
                System.out.println("-> De to modeller giver præcis samme slutværdi.");
            }
        }
    }

    public static Result ask(int years, double yearlyReturn, int startCash, boolean payTaxExternally) {
        double money = startCash;
        double tax;
        double totalTax = 0;
        List<AskYearData> yearData = new ArrayList<>();

        for (int i = 1; i <= years; i++) {
            double startOfYearValue = money;
            double endOfYearValueBeforeTax = money * yearlyReturn;
            double profit = endOfYearValueBeforeTax - startOfYearValue;

            tax = profit * ASK_TAX; //17% skat af værdistigningen hvert år
            totalTax += tax;

            if (payTaxExternally) {
                // Skatten betales "udefra" – værdien af aktierne får lov at stige ubeskåret
                money = endOfYearValueBeforeTax;
            } else {
                // Skatten trækkes direkte fra kontoen
                money = endOfYearValueBeforeTax - tax;
            }

            yearData.add(new AskYearData(i, money, tax));
        }

        System.out.println("============RESULTAT PÅ AKTIESPAREKONTO============");
        printAskTable(yearData);
        System.out.println();
        System.out.printf(DK, "Efter %d år, er de %,d kr. vokset til %,.0f kr.%n", years, startCash, money);

        double percentageIncrease;
        double nettogevinst;
        // Samlet kapital du reelt har puttet i - inkl. evt. løbende skattebetalinger udefra
        double totalCapitalInvested = startCash + (payTaxExternally ? totalTax : 0);

        if (payTaxExternally) {
            System.out.printf(DK, "OBS: Du har løbende indbetalt i alt %,.0f kr. fra andre midler for at dække skatten.%n", totalTax);
            nettogevinst = money - startCash - totalTax;
            System.out.printf(DK, "Din reelle nettogevinst er: %,.0f kr.%n", nettogevinst);
        } else {
            nettogevinst = money - startCash;
            System.out.printf(DK, "Din reelle nettogevinst (værdi - startindskud) er: %,.0f kr.%n", nettogevinst);
        }
        // Procenten regnes ift. den SAMLEDE kapital du har puttet i - ellers bliver den
        // kunstigt høj, hvis du løbende har tilført ekstra penge til at betale skatten
        percentageIncrease = nettogevinst / totalCapitalInvested * 100;
        System.out.printf(DK, "Det er en stigning på +%.1f%% ift. den samlede kapital, du har investeret (%,.0f kr.)%n", percentageIncrease, totalCapitalInvested);

        return new Result("Aktiesparekonto", money, nettogevinst, percentageIncrease);
    }

    private static void printAskTable(List<AskYearData> yearData) {
        System.out.printf(DK, "%-6s %18s %18s%n", "År", "Værdi", "Skat betalt");
        System.out.println("-".repeat(45));
        for (AskYearData d : yearData) {
            System.out.printf(DK, "%-6d %,18.0f %,18.0f%n", d.year(), d.value(), d.taxThisYear());
        }
    }

    // Regner (uden print) den faktiske slutformue EFTER skat for et givent startår for
    // høsten. Fra og med 'harvestStartYear' og indtil sidste år, høstes der maksimalt
    // (op til 79.400 kr.) hvert år. Sidste år sælges alt, med korrekt progressiv skat.
    private static double computeFinalValueForStartYear(int years, double yearlyReturn, int startCash,
                                                        boolean investSavedAskTax, int harvestStartYear) {
        double shareValue = startCash;
        double costBasis = startCash;
        double shadowAskMoney = startCash;

        for (int i = 1; i <= years; i++) {
            if (investSavedAskTax) {
                double shadowAskProfit = (shadowAskMoney * yearlyReturn) - shadowAskMoney;
                double askTaxThisYear = shadowAskProfit > 0 ? shadowAskProfit * ASK_TAX : 0;
                shadowAskMoney = shadowAskMoney * yearlyReturn;
                if (askTaxThisYear > 0) {
                    shareValue += askTaxThisYear;
                    costBasis += askTaxThisYear;
                }
            }

            shareValue = shareValue * yearlyReturn;

            if (i < years) {
                if (i >= harvestStartYear) {
                    double unrealizedProfit = shareValue - costBasis;
                    if (unrealizedProfit > 0) {
                        double profitToRealize = Math.min(unrealizedProfit, TAX_LIMIT_27);
                        double tax = profitToRealize * AKT_TAX_LOW;
                        shareValue -= tax;
                        costBasis += (profitToRealize - tax);
                    }
                }
            } else {
                double finalUnrealizedProfit = shareValue - costBasis;
                if (finalUnrealizedProfit > 0) {
                    double tax;
                    if (finalUnrealizedProfit <= TAX_LIMIT_27) {
                        tax = finalUnrealizedProfit * AKT_TAX_LOW;
                    } else {
                        tax = (TAX_LIMIT_27 * AKT_TAX_LOW) + (finalUnrealizedProfit - TAX_LIMIT_27) * AKT_TAX_HIGH;
                    }
                    shareValue -= tax;
                }
            }
        }
        return shareValue;
    }

    // Finder det startår, der reelt giver den HØJESTE slutformue - ved at afprøve alle
    // mulige startår (år 1, 2, 3, ... helt op til "aldrig") og sammenligne det faktiske
    // resultat. I modsætning til den gamle metode antager denne IKKE at det er bedst at
    // undgå 42%-skat for enhver pris - hvis det rent faktisk kan betale sig at vente og
    // betale lidt 42% til sidst, vil søgningen selv opdage det.
    private static int findBestHarvestStartYear(int years, double yearlyReturn, int startCash, boolean investSavedAskTax) {
        int bestStart = years; // "years" = ingen tidlig høst overhovedet, alt sælges i sidste år
        double bestValue = computeFinalValueForStartYear(years, yearlyReturn, startCash, investSavedAskTax, bestStart);

        for (int candidateStart = years - 1; candidateStart >= 1; candidateStart--) {
            double value = computeFinalValueForStartYear(years, yearlyReturn, startCash, investSavedAskTax, candidateStart);
            if (value > bestValue) {
                bestValue = value;
                bestStart = candidateStart;
            }
        }
        return bestStart;
    }

    // Regner (uden print) slutværdien for en given strategi, så vi kan sammenligne
    // "optimeret høst" direkte med "vent til sidste år" for de samme tal.
    private static double computeAktFinalValue(int years, double yearlyReturn, int startCash,
                                               boolean investSavedAskTax, boolean harvestGains) {
        int harvestStartYear = harvestGains
                ? findBestHarvestStartYear(years, yearlyReturn, startCash, investSavedAskTax)
                : years;
        return computeFinalValueForStartYear(years, yearlyReturn, startCash, investSavedAskTax, harvestStartYear);
    }

    public static Result akt(int years, double yearlyReturn, int startCash, boolean investSavedAskTax, boolean harvestGains) {
        double shareValue = startCash;      // Værdi bundet i aktier (ALT er investeret hele tiden)
        double costBasis = startCash;       // Anskaffelsessum (hvad vi "har betalt" for aktierne i alt)
        double totalTaxPaid = 0;            // Samlet betalt skat over årene
        double totalExtraInvested = 0;      // Ekstra indbetalinger (hvis man investerer "ASK-skatten")
        double shadowAskMoney = startCash;  // Hjælpevariabel til at simulere "hvad ASK-skatten ville have været"
        List<AktYearData> yearData = new ArrayList<>();

        // Find det startår, der reelt giver den højeste slutformue (ikke bare undgår 42%)
        int harvestStartYear = harvestGains
                ? findBestHarvestStartYear(years, yearlyReturn, startCash, investSavedAskTax)
                : years; // "years" betyder: høst aldrig undervejs

        for (int i = 1; i <= years; i++) {
            // 1. Eventuel ekstra investering (svarende til det man ville betale i ASK-skat) i starten af året
            if (investSavedAskTax) {
                double shadowAskProfit = (shadowAskMoney * yearlyReturn) - shadowAskMoney;
                double askTaxThisYear = shadowAskProfit > 0 ? shadowAskProfit * ASK_TAX : 0;

                shadowAskMoney = shadowAskMoney * yearlyReturn;

                if (askTaxThisYear > 0) {
                    shareValue += askTaxThisYear;
                    costBasis += askTaxThisYear; // Ny indbetaling hæver anskaffelsessummen
                    totalExtraInvested += askTaxThisYear;
                }
            }

            // 2. Årets afkast på aktierne
            shareValue = shareValue * yearlyReturn;

            // 3a. Skatteoptimering (kun FØR sidste år): høst kun fra og med det på forhånd
            //     udregnede startår (harvestStartYear), som er fundet ved reelt at afprøve
            //     alle mulige startår og vælge det, der giver højest slutformue. Sælg og
            //     køb straks tilbage - alle pengene forbliver investeret, kun skatten
            //     forlader depotet.
            // 3b. Sidste år: her sælges ALT, og der beregnes progressiv skat (27%/42%)
            //     ÉN gang på hele den resterende urealiserede gevinst.
            double realizedAt27 = 0;
            double realizedAt42 = 0;

            if (i < years) {
                if (harvestGains && i >= harvestStartYear) {
                    double unrealizedProfit = shareValue - costBasis;

                    if (unrealizedProfit > 0) {
                        double profitToRealize = Math.min(unrealizedProfit, TAX_LIMIT_27);
                        double tax = profitToRealize * AKT_TAX_LOW;
                        totalTaxPaid += tax;

                        shareValue -= tax;                          // kun skatten forsvinder fra depotet
                        costBasis += (profitToRealize - tax);       // resten geninvesteres til ny anskaffelsessum
                        realizedAt27 = profitToRealize;
                    }
                }
            } else {
                // Sidste år: sælg alt, betal progressiv skat én gang
                double finalUnrealizedProfit = shareValue - costBasis;
                if (finalUnrealizedProfit > 0) {
                    double tax;
                    if (finalUnrealizedProfit <= TAX_LIMIT_27) {
                        tax = finalUnrealizedProfit * AKT_TAX_LOW;
                        realizedAt27 = finalUnrealizedProfit;
                    } else {
                        double taxLow = TAX_LIMIT_27 * AKT_TAX_LOW;
                        double taxHigh = (finalUnrealizedProfit - TAX_LIMIT_27) * AKT_TAX_HIGH;
                        tax = taxLow + taxHigh;
                        realizedAt27 = TAX_LIMIT_27;
                        realizedAt42 = finalUnrealizedProfit - TAX_LIMIT_27;
                    }
                    totalTaxPaid += tax;
                    shareValue -= tax;
                }
                costBasis = shareValue; // alt er nu realiseret og beskattet
            }

            yearData.add(new AktYearData(i, shareValue, realizedAt27, realizedAt42));
        }

        System.out.println("============RESULTAT PÅ ALMINDELIGT DEPOT============");
        printAktTable(yearData);
        System.out.println();

        // Alt er allerede realiseret og beskattet i loopets sidste iteration (sidste år)
        double totalFinalValue = shareValue;
        double totalInvested = startCash + totalExtraInvested;
        double netProfit = totalFinalValue - totalInvested;
        double percentageIncrease = (netProfit / totalInvested) * 100;

        System.out.printf(DK, "Samlet værdi (alt solgt og beskattet): %,.0f kr.%n", totalFinalValue);

        System.out.println();
        System.out.printf(DK, "Startindskud: %,d kr.%n", startCash);
        if (investSavedAskTax) {
            System.out.printf(DK, "Løbende ekstra investeret (svarende til ASK-skat): %,.0f kr.%n", totalExtraInvested);
        }
        System.out.printf(DK, "Samlet betalt skat over alle år: %,.0f kr.%n", totalTaxPaid);

        System.out.println();
        System.out.printf(DK, "Din reelle nettogevinst efter skat: %,.0f kr.%n", netProfit);
        System.out.printf(DK, "Det er en samlet stigning på +%.1f%%%n", percentageIncrease);

        System.out.println();
        System.out.println("----BEDSTE STRATEGI----");
        System.out.println("Bedste strategi: begynd realisering af afkast i år " + harvestStartYear + " (ud af " + years + " år i alt).");

        //Udregner resultatet, hvis man bare sælger det hele i sidste år
        double oppositeFinalValue = computeAktFinalValue(years, yearlyReturn, startCash, investSavedAskTax, !harvestGains);
        System.out.printf(DK, "Hvis du i stedet slet ikke sælger undervejs (alt beskattet progressivt i sidste år): %,.0f kr.%n", oppositeFinalValue);

        double diff = totalFinalValue - oppositeFinalValue;
        System.out.printf(DK, "-> Din strategi gav %,.0f kr. mere.%n", diff);

        return new Result("Aktiedepot", totalFinalValue, netProfit, percentageIncrease);
    }

    private static void printAktTable(List<AktYearData> yearData) {
        System.out.printf(DK, "%-6s %18s %16s %16s%n", "År", "Værdi", "Realis. @27%", "Realis. @42%");
        System.out.println("-".repeat(70));
        for (AktYearData d : yearData) {
            String r27 = d.realizedAt27() > 0 ? String.format(DK, "%,.0f", d.realizedAt27()) : "-";
            String r42 = d.realizedAt42() > 0 ? String.format(DK, "%,.0f", d.realizedAt42()) : "-";
            System.out.printf(DK, "%-6d %,18.0f %16s %16s%n", d.year(), d.value(), r27, r42);
        }
    }

    private static int readPositiveInt(Scanner sc, String prompt, int max, String errorMsg) {
        System.out.println(prompt);
        int value = sc.nextInt();
        while (value <= 0 || value > max) {
            System.out.println(errorMsg);
            value = sc.nextInt();
        }
        return value;
    }

    private static double readPositiveDouble(Scanner sc, String prompt, String errorMsg) {
        System.out.println(prompt);
        double value = sc.nextDouble();
        while (value <= 0) {
            System.out.println(errorMsg);
            value = sc.nextDouble();
        }
        return value;
    }

    private static boolean readBooleanInput(Scanner sc, String prompt, String errorMsg) {
        System.out.println(prompt);
        boolean value = false;
        boolean found = false;

        while (!found) {
            String input = sc.next();

            if (input.equalsIgnoreCase("ja")){
                value = true;
                found = true;
            } else if (input.equalsIgnoreCase("nej")){
                found = true;
            } else {
                System.out.println(errorMsg);
            }
        }

        return value;
    }
}